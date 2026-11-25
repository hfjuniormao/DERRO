#!/usr/bin/env python3
"""
CENTRAL INFRA RO 360 — Smoke test funcional (Playwright).

Verifica, contra a aplicacao servida (local ou publicada):
  1. a home carrega com banner, faixa de indicadores e cards de aplicativos;
  2. todas as rotas do menu navegam sem erro de console relevante;
  3. o mapa ArcGIS renderiza (canvas do WebGL presente);
  4. os filtros alteram os dados exibidos (contagem de linhas da tabela);
  5. a ficha de obra abre a partir da tabela.

Uso:
    python3 tests/smoke_test.py                       # sobe dist/ localmente
    python3 tests/smoke_test.py http://127.0.0.1:8765
    python3 tests/smoke_test.py https://exemplo.vercel.app
"""
from __future__ import annotations

import functools
import http.server
import os
import socket
import socketserver
import subprocess
import sys
import threading
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, "dist")

ROTAS = [
    ("inicio", "Central INFRA RO 360"),
    ("painel", "Painel executivo"),
    ("municipios", "Perfil dos municípios"),
    ("rodovias", "Sistema rodoviário"),
    ("obras", "Gestão de Obras Públicas 360"),
    ("ativos", "Gestão de pontes e ativos"),
    ("contratos", "Gestão de contratos"),
    ("convenios", "Convênios"),
    ("maquinas", "Máquinas"),
    ("logistica", "Logística"),
    ("meioambiente", "Meio ambiente"),
    ("planejamento", "Planejamento"),
    ("geoai", "GeoAI"),
    ("assistente", "InfraAI RO"),
    ("mapa", "Geoportal"),
    ("fiscalizacao", "Fiscalização"),
    ("dados-abertos", "Dados abertos"),
    ("fontes", "Catálogo de fontes"),
    ("admin", "Administração"),
    ("documentacao", "Documentação"),
]

# Erros de rede conhecidos do ambiente de teste (não são regressão)
RUIDO = (
    "ERR_CERT_AUTHORITY_INVALID",
    "agent.minimax.io",
    "favicon",
    "404 space-grotesk",
    "TextureManager",
    "net::ERR_",
    # Renderização por software (SwiftShader) no CI: aviso de driver WebGL.
    "GL Driver Message",
    "GPU stall",
)


def _chromium_executable():
    """Caminho do Chromium do Playwright (o layout mudou entre versões)."""
    base = os.path.join(os.path.expanduser("~"), ".cache", "ms-playwright")
    if not os.path.isdir(base):
        return None
    candidatos = []
    for pasta in sorted(os.listdir(base)):
        if "chromium" not in pasta:
            continue
        candidatos += [
            os.path.join(base, pasta, "chrome-linux", "chrome"),
            os.path.join(base, pasta, "chrome-linux64", "chrome"),
        ]
    for caminho in candidatos:
        if os.path.exists(caminho):
            return caminho
    return None


def servir_dist(porta: int) -> str:
    if not os.path.isdir(DIST):
        raise SystemExit("dist/ não existe — rode `npm run build` antes do smoke test.")

    class Manipulador(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args, **kwargs):  # silencia o log do servidor
            pass

    class Servidor(socketserver.TCPServer):
        allow_reuse_address = True
        daemon_threads = True

    # ATENCAO: o socket NAO pode ser fechado aqui. Usar `with Servidor(...)`
    # encerraria o bloco (e o socket) no momento do return, antes de o
    # navegador conectar -> ERR_CONNECTION_REFUSED.
    servidor = Servidor(("127.0.0.1", porta), functools.partial(Manipulador, directory=DIST))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{porta}", servidor


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    from playwright.sync_api import sync_playwright

    url_alvo = sys.argv[1] if len(sys.argv) > 1 else None
    servidor = None
    if not url_alvo:
        porta = porta_livre()
        url_alvo, servidor = servir_dist(porta)
        print(f"[smoke] servindo dist/ em {url_alvo}")

    executavel = _chromium_executable()
    if executavel:
        print(f"[smoke] chromium: {executavel}")

    falhas = []
    avisos = []
    erros_relevantes = []

    with sync_playwright() as p:
        navegador = p.chromium.launch(
            headless=True,
            executable_path=executavel,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
        )
        contexto = navegador.new_context(viewport={"width": 1440, "height": 960})
        pagina = contexto.new_page()

        def registrar_console(msg):
            if msg.type in ("error", "warning"):
                texto = msg.text
                if any(ruido in texto for ruido in RUIDO):
                    return
                erros_relevantes.append(f"{msg.type}: {texto[:220]}")

        pagina.on("console", registrar_console)
        pagina.on("pageerror", lambda exc: erros_relevantes.append(f"pageerror: {str(exc)[:220]}"))

        # ---------------------------------------------------------- home
        pagina.goto(f"{url_alvo}/index.html#/inicio", wait_until="networkidle", timeout=90000)
        pagina.wait_for_selector(".banner__titulo", timeout=45000)
        titulo = pagina.inner_text(".banner__titulo")
        if "CENTRAL INFRA RO 360" not in titulo:
            falhas.append(f"home: titulo inesperado -> {titulo!r}")
        indicadores = pagina.locator(".faixa-indicadores__item").count()
        if indicadores < 4:
            falhas.append(f"home: apenas {indicadores} indicadores na faixa")
        cards = pagina.locator(".cartao--aplicativo").count()
        if cards < 10:
            falhas.append(f"home: apenas {cards} cards de aplicativo")
        print(f"[smoke] home ok — {indicadores} indicadores, {cards} cards")

        # --------------------------------------------------------- rotas
        for rota, esperado in ROTAS:
            erros_antes = len(erros_relevantes)
            try:
                pagina.goto(f"{url_alvo}/index.html#/{rota}", wait_until="domcontentloaded", timeout=45000)
                pagina.wait_for_timeout(2500)
                conteudo = pagina.inner_text("#conteudo")
                if not conteudo.strip():
                    falhas.append(f"rota /{rota}: conteudo vazio")
                    continue
                if esperado.lower() not in conteudo.lower():
                    avisos.append(f"rota /{rota}: texto esperado {esperado!r} nao localizado")
                novos = erros_relevantes[erros_antes:]
                if novos:
                    falhas.append(f"rota /{rota}: {len(novos)} erro(s) de console -> {novos[0]}")
                print(f"[smoke] /{rota} ok ({len(conteudo)} chars)")
            except Exception as exc:  # noqa: BLE001
                falhas.append(f"rota /{rota}: excecao {str(exc)[:180]}")

        # ------------------------------------------------------- mapa
        tiles_requisitados = []

        def registrar_tile(resposta):
            if "arcgisonline" in resposta.url and "/tile/" in resposta.url:
                tiles_requisitados.append(resposta.status)

        pagina.on("response", registrar_tile)
        pagina.goto(f"{url_alvo}/index.html#/mapa", wait_until="domcontentloaded", timeout=45000)
        pagina.wait_for_timeout(14000)
        canvas = pagina.locator(".mapa-area canvas").count()
        if canvas == 0:
            falhas.append("mapa: canvas do ArcGIS nao encontrado")
        else:
            print(f"[smoke] mapa: {canvas} canvas renderizado")
        if pagina.locator(".mapa-painel").count() == 0:
            falhas.append("mapa: painel de camadas ausente")
        legenda = pagina.locator(".camada-item").count()
        print(f"[smoke] mapa: {legenda} camadas no catalogo")
        if not tiles_requisitados:
            falhas.append("mapa: nenhum tile do basemap foi requisitado (mapa base nao carregou)")
        elif any(s != 200 for s in tiles_requisitados):
            falhas.append(
                f"mapa: {sum(1 for s in tiles_requisitados if s != 200)} tile(s) do basemap com erro"
            )
        else:
            print(f"[smoke] mapa: {len(tiles_requisitados)} tiles do basemap carregados (HTTP 200)")

        # ------------------------------------------- filtro altera dados
        pagina.goto(f"{url_alvo}/index.html#/obras", wait_until="domcontentloaded", timeout=45000)
        pagina.wait_for_selector(".tabela tbody tr", timeout=45000)
        antes = pagina.locator(".tabela tbody tr").count()
        total_antes = pagina.inner_text(".paginacao__info")
        pagina.select_option("#filtro-situacao", "atrasada")
        pagina.wait_for_timeout(1800)
        depois = pagina.locator(".tabela tbody tr").count()
        total_depois = pagina.inner_text(".paginacao__info")
        if antes == depois and total_antes == total_depois:
            falhas.append("filtros: o filtro de situacao nao alterou o conjunto exibido")
        else:
            print(f"[smoke] filtro ok: {total_antes.strip()} -> {total_depois.strip()}")

        # ------------------------------------------------- ficha de obra
        pagina.locator(".tabela tbody tr").first.click()
        pagina.wait_for_timeout(1500)
        if pagina.locator(".drawer__caixa").count() == 0:
            falhas.append("fichas: a ficha da obra nao abriu")
        else:
            print("[smoke] ficha de obra abriu")
        pagina.keyboard.press("Escape")
        pagina.wait_for_timeout(500)

        # -------------------------------------------------- captura final
        os.makedirs(os.path.join(RAIZ, "tests", "capturas"), exist_ok=True)
        pagina.goto(f"{url_alvo}/index.html#/inicio", wait_until="domcontentloaded", timeout=45000)
        pagina.wait_for_timeout(7000)
        pagina.screenshot(path=os.path.join(RAIZ, "tests", "capturas", "home.png"), full_page=False)
        pagina.goto(f"{url_alvo}/index.html#/mapa", wait_until="domcontentloaded", timeout=45000)
        pagina.wait_for_timeout(14000)
        pagina.screenshot(path=os.path.join(RAIZ, "tests", "capturas", "mapa.png"), full_page=False)
        pagina.goto(f"{url_alvo}/index.html#/painel", wait_until="domcontentloaded", timeout=45000)
        pagina.wait_for_timeout(6000)
        pagina.screenshot(path=os.path.join(RAIZ, "tests", "capturas", "painel.png"), full_page=False)

        # --------------------------------------------- responsivo (mobile)
        mobile = contexto.new_page()
        mobile.set_viewport_size({"width": 390, "height": 844})
        erros_antes_mobile = len(erros_relevantes)
        mobile.goto(f"{url_alvo}/index.html#/inicio", wait_until="domcontentloaded", timeout=45000)
        mobile.wait_for_timeout(6000)
        largura_desbordamento = mobile.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        if largura_desbordamento > 4:
            falhas.append(f"mobile: conteudo transborda horizontalmente ({largura_desbordamento}px)")
        mobile.screenshot(path=os.path.join(RAIZ, "tests", "capturas", "mobile-home.png"), full_page=False)
        mobile.goto(f"{url_alvo}/index.html#/mapa", wait_until="domcontentloaded", timeout=45000)
        mobile.wait_for_timeout(8000)
        mobile.screenshot(path=os.path.join(RAIZ, "tests", "capturas", "mobile-mapa.png"), full_page=False)
        novos_mobile = erros_relevantes[erros_antes_mobile:]
        if novos_mobile:
            falhas.append(f"mobile: {len(novos_mobile)} erro(s) de console -> {novos_mobile[0]}")
        mobile.close()
        print("[smoke] responsivo mobile ok")

        print("[smoke] capturas salvas em tests/capturas/")

        navegador.close()

    if servidor is not None:
        servidor.shutdown()
        servidor.server_close()

    print("\n================ RESULTADO ================")
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    for erro in erros_relevantes[:12]:
        print(f"ERRO CONSOLE: {erro}")
    for falha in falhas:
        print(f"FALHA: {falha}")
    if falhas:
        print(f"\nRESULTADO: FALHOU ({len(falhas)} falha(s))")
        return 1
    print("\nRESULTADO: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
