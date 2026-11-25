#!/usr/bin/env python3
"""Depuracao de rota: abre uma rota no dist/ e mostra erros + conteudo."""
import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, "dist")


def _chromium_executable():
    base = os.path.join(os.path.expanduser("~"), ".cache", "ms-playwright")
    if not os.path.isdir(base):
        return None
    for pasta in sorted(os.listdir(base)):
        if "chromium" not in pasta:
            continue
        for sub in ("chrome-linux64", "chrome-linux"):
            caminho = os.path.join(base, pasta, sub, "chrome")
            if os.path.exists(caminho):
                return caminho
    return None


def porta_livre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Manipulador(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass


def main():
    from playwright.sync_api import sync_playwright

    rotas = sys.argv[1:] or ["painel", "municipios", "rodovias", "obras", "ativos", "contratos"]
    porta = porta_livre()
    servidor = socketserver.TCPServer(("127.0.0.1", porta), functools.partial(Manipulador, directory=DIST))
    servidor.daemon_threads = True
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{porta}"

    with sync_playwright() as p:
        navegador = p.chromium.launch(
            headless=True,
            executable_path=_chromium_executable(),
            args=["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
        )
        contexto = navegador.new_context(viewport={"width": 1440, "height": 960})
        pagina = contexto.new_page()
        erros = []
        pagina.on("console", lambda m: erros.append(f"{m.type}: {m.text[:300]}") if m.type in ("error", "warning") else None)
        pagina.on("pageerror", lambda e: erros.append(f"pageerror: {str(e)[:400]}"))

        pagina.goto(f"{url}/index.html#/inicio", wait_until="networkidle", timeout=90000)
        pagina.wait_for_timeout(3000)

        for rota in rotas:
            erros.clear()
            pagina.goto(f"{url}/index.html#/{rota}", wait_until="domcontentloaded", timeout=45000)
            pagina.wait_for_timeout(3500)
            conteudo = pagina.inner_text("#conteudo")
            print(f"\n===== /{rota} ===== ({len(conteudo)} chars)")
            print("  conteudo:", repr(conteudo[:220]))
            for e in erros[:8]:
                print("  >", e)
            erros.clear()

        navegador.close()

    servidor.shutdown()
    servidor.server_close()


if __name__ == "__main__":
    main()
