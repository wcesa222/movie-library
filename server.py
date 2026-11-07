"""课程实验用静态文件服务器，仅使用 Python 标准库。"""

from __future__ import annotations

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent


class NoCacheRequestHandler(SimpleHTTPRequestHandler):
    """提供静态文件，并禁止浏览器缓存实验数据。"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def parse_port() -> int:
    if len(sys.argv) == 1:
        return 8000
    try:
        port = int(sys.argv[1])
    except ValueError as exc:
        raise SystemExit("端口必须是整数，例如：python server.py 8080") from exc
    if not 1 <= port <= 65535:
        raise SystemExit("端口范围必须在 1 到 65535 之间。")
    return port


def main() -> None:
    port = parse_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), NoCacheRequestHandler)
    print("电影资料库服务器已启动")
    print(f"项目目录：{PROJECT_DIR}")
    print(f"访问地址：http://localhost:{port}")
    print("按 Ctrl+C 停止服务器")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
