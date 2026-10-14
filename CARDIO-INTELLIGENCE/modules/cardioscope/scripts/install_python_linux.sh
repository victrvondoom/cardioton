#!/bin/sh
# Build the exact frozen interpreter from checksum-verified official CPython source.
# Requires Ubuntu build dependencies documented in docs/REPRODUCIBILITY.md.
set -eu
prefix=${1:?Usage: scripts/install_python_linux.sh ABSOLUTE_INSTALL_PREFIX}
case "$prefix" in /*) ;; *) echo 'Install prefix must be absolute.' >&2; exit 1 ;; esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
cd "$work"
curl --fail --location --retry 3 -o Python.tar.xz \
  https://www.python.org/ftp/python/3.12.14/Python-3.12.14.tar.xz
printf '%s  Python.tar.xz\n' '5c8462af5790baf43a321a1559dbe0db06d1be4300fb85fb53c40060668e548a' | sha256sum --check --strict
tar -xf Python.tar.xz
cd Python-3.12.14
./configure --prefix="$prefix" --with-ensurepip=no > configure.log
make -j2 > build.log 2>&1 || { tail -n 60 build.log; exit 1; }
make install > install.log 2>&1 || { tail -n 60 install.log; exit 1; }
"$prefix/bin/python3.12" -c 'import sys,ssl,bz2,lzma,sqlite3,ctypes; assert sys.version_info[:3] == (3,12,14); print(sys.version)'
