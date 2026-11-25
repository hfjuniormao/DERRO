#!/usr/bin/env python3
"""Publica o conteudo ja compilado de `dist/` na Vercel via API REST.

Usado quando a CLI oficial nao e viavel -- por exemplo, quando o token pertence
a uma equipe e nao a uma conta pessoal: o preflight `GET /v2/user` da CLI
responde `404 User not found`. A API REST funciona normalmente, desde que o
`teamId` da equipe seja informado.

O fluxo e em duas etapas, porque o corpo de `POST /v13/deployments` tem limite
de 10 MB e o `dist/` desta plataforma tem ~23 MB:

1. cada arquivo de `dist/` e enviado para `POST /v2/files` (corpo binario,
   digest SHA-1 no header `x-now-digest`);
2. `POST /v13/deployments` referencia os arquivos pelo SHA retornado.

Nao ha build no servidor: os arquivos enviados sao a saida estatica.

Variaveis de ambiente:
  VERCEL_TOKEN     token da Vercel (obrigatorio; nunca gravado em arquivo)
  VERCEL_TEAM      teamId da equipe (necessario para token de equipe)
  VERCEL_PROJECT   nome do projeto de destino (padrao: mapa-obras-ro)
  VERCEL_TARGET    `production` (padrao) ou `staging`

Nenhum segredo e escrito no repositorio nem impresso no log.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://api.vercel.com"
RAIZ = Path(__file__).resolve().parent.parent
DIST = RAIZ / "dist"
TRABALHADORES = 12


def pedir(metodo: str, caminho: str, token: str, corpo: dict | None = None,
          bruto: bytes | None = None, digest: str | None = None,
          tamanho: int | None = None) -> dict:
    url = f"{API}{caminho}"
    dados = json.dumps(corpo).encode() if corpo is not None else bruto
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header("Authorization", f"Bearer {token}")
    if bruto is not None:
        req.add_header("Content-Type", "application/octet-stream")
        req.add_header("x-now-digest", digest or "")
        req.add_header("x-now-size", str(tamanho or 0))
    else:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as erro:
        detalhe = erro.read().decode()[:600]
        raise SystemExit(f"Falha HTTP {erro.code} em {metodo} {caminho}: {detalhe}")


def enviar_arquivo(token: str, consulta: str, caminho: str, dados: bytes) -> dict:
    """Envia um arquivo e devolve a entrada `files[]` do deployment."""
    digest = hashlib.sha1(dados).hexdigest()
    resposta = pedir(
        "POST", f"/v2/files{consulta}", token,
        bruto=dados, digest=digest, tamanho=len(dados),
    )
    return {"file": caminho, "sha": digest, "size": len(dados), "urls": resposta.get("urls", [])}


def coletar_arquivos(dist: Path) -> list[tuple[str, bytes]]:
    arquivos = []
    for caminho in sorted(dist.rglob("*")):
        if caminho.is_file():
            arquivos.append((caminho.relative_to(dist).as_posix(), caminho.read_bytes()))
    return arquivos


def main() -> int:
    token = os.environ.get("VERCEL_TOKEN", "").strip()
    if not token:
        raise SystemExit("VERCEL_TOKEN nao definido.")
    if not DIST.is_dir():
        raise SystemExit("dist/ ausente -- rode `npm run build` antes.")

    team = os.environ.get("VERCEL_TEAM", "").strip()
    projeto = os.environ.get("VERCEL_PROJECT", "mapa-obras-ro").strip()
    alvo = os.environ.get("VERCEL_TARGET", "production").strip()
    consulta = f"?teamId={team}" if team else ""

    arquivos = coletar_arquivos(DIST)
    total = sum(len(dados) for _, dados in arquivos)
    print(f">>> {len(arquivos)} arquivos / {total / 1e6:.1f} MB -> projeto '{projeto}' ({alvo})")

    print(">>> etapa 1/2: upload dos arquivos")
    entradas: list[dict] = []
    with ThreadPoolExecutor(max_workers=TRABALHADORES) as pool:
        futures = [pool.submit(enviar_arquivo, token, consulta, nome, dados)
                   for nome, dados in arquivos]
        for indice, futuro in enumerate(futures, start=1):
            entradas.append(futuro.result())
            if indice % 100 == 0 or indice == len(futures):
                print(f">>>    {indice}/{len(futures)} arquivos enviados")

    print(">>> etapa 2/2: criacao do deployment")
    corpo = {
        "name": projeto,
        "target": alvo,
        # Sem framework e sem buildCommand: a Vercel serve os arquivos enviados
        # como saida estatica na raiz do deployment (nenhum build no servidor).
        "projectSettings": {
            "framework": None,
            "buildCommand": None,
            "outputDirectory": None,
        },
        "files": [{k: v for k, v in entrada.items() if k != "urls"} for entrada in entradas],
    }

    resposta = pedir("POST", f"/v13/deployments{consulta}", token, corpo)
    dep_id = resposta.get("id")
    print(f">>> deployment {dep_id} -> {resposta.get('url')}")

    for _ in range(120):
        estado = pedir("GET", f"/v13/deployments/{dep_id}{consulta}", token)
        pronto = estado.get("readyState")
        print(f">>> readyState={pronto}")
        if pronto in ("READY", "ERROR", "CANCELED"):
            if pronto != "READY":
                raise SystemExit(
                    f"Deployment {dep_id} falhou: {estado.get('errorCode')} {estado.get('errorMessage')}"
                )
            print(f">>> PUBLICO: https://{estado.get('url')}")
            for alias in estado.get("alias") or []:
                print(f">>> ALIAS: https://{alias}")
            return 0
        time.sleep(5)
    raise SystemExit("Tempo esgotado aguardando o deployment.")


if __name__ == "__main__":
    sys.exit(main())
