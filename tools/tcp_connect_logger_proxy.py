#!/usr/bin/env python3
import socket, socketserver, select, threading, time, sys, re
from pathlib import Path

LOG = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('proxy_capture.log')
HOST = '0.0.0.0'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8888
SENSITIVE = re.compile(r'(authorization|token|cookie|set-cookie|password|secret|apikey|api-key)', re.I)

def log(line):
    ts=time.strftime('%Y-%m-%d %H:%M:%S')
    with LOG.open('a', encoding='utf-8') as f:
        f.write(f'{ts} {line}\n')
        f.flush()

class Handler(socketserver.StreamRequestHandler):
    timeout = 20
    def handle(self):
        try:
            first = self.rfile.readline(65536)
            if not first: return
            try: line = first.decode('iso-8859-1').strip()
            except Exception: line = repr(first[:120])
            parts = line.split()
            if len(parts) < 2:
                log(f'MALFORMED {self.client_address} {line[:300]}')
                return
            method, target = parts[0].upper(), parts[1]
            headers=[]
            while True:
                h=self.rfile.readline(65536)
                if not h or h in (b'\r\n', b'\n'): break
                hs=h.decode('iso-8859-1','replace').strip()
                if SENSITIVE.search(hs): hs=re.sub(r':\s*.*', ': [REDACTED]', hs)
                headers.append(hs)
            host_header=next((h.split(':',1)[1].strip() for h in headers if h.lower().startswith('host:')), '')
            if method == 'CONNECT':
                host, _, port_s = target.partition(':')
                port=int(port_s or 443)
                log(f'CONNECT client={self.client_address[0]} target={host}:{port}')
                try:
                    remote=socket.create_connection((host, port), timeout=10)
                except Exception as e:
                    log(f'CONNECT_FAIL target={host}:{port} err={type(e).__name__}:{e}')
                    self.wfile.write(b'HTTP/1.1 502 Bad Gateway\r\n\r\n')
                    return
                self.wfile.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
                self.tunnel(self.connection, remote)
            else:
                log(f'HTTP {method} target={target[:500]} host={host_header}')
                # Minimal non-CONNECT forwarding for plain HTTP.
                host=host_header.split(':')[0]
                port=int(host_header.split(':')[1]) if ':' in host_header else 80
                try:
                    remote=socket.create_connection((host,port),timeout=10)
                    remote.sendall(first)
                    for h in headers: remote.sendall((h+'\r\n').encode('iso-8859-1'))
                    remote.sendall(b'\r\n')
                    self.tunnel(self.connection, remote)
                except Exception as e:
                    log(f'HTTP_FAIL host={host_header} err={type(e).__name__}:{e}')
                    try: self.wfile.write(b'HTTP/1.1 502 Bad Gateway\r\n\r\n')
                    except Exception: pass
        except Exception as e:
            log(f'HANDLER_ERR {type(e).__name__}:{e}')
    def tunnel(self, a, b):
        sockets=[a,b]
        try:
            while True:
                r,_,_=select.select(sockets,[],[],30)
                if not r: break
                for s in r:
                    data=s.recv(65536)
                    if not data: return
                    (b if s is a else a).sendall(data)
        finally:
            try: b.close()
            except Exception: pass

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address=True
    daemon_threads=True

if __name__ == '__main__':
    LOG.parent.mkdir(parents=True, exist_ok=True)
    log(f'PROXY_START {HOST}:{PORT}')
    with Server((HOST, PORT), Handler) as srv:
        srv.serve_forever()
