import os
import struct
import zlib

out = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(out, exist_ok=True)


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size):
    raw = bytearray()
    margin = max(1, round(size * 0.08))
    radius = max(2, round(size * 0.22))

    def inside(x, y):
        if not (margin <= x < size - margin and margin <= y < size - margin):
            return False
        in_corner_x = x < margin + radius or x >= size - margin - radius
        in_corner_y = y < margin + radius or y >= size - margin - radius
        if not (in_corner_x and in_corner_y):
            return True
        cx = margin + radius if x < size / 2 else size - margin - radius - 1
        cy = margin + radius if y < size / 2 else size - margin - radius - 1
        dx, dy = x - cx, y - cy
        return dx * dx + dy * dy <= radius * radius

    def on_paper(x, y):
        left, top = int(size * 0.30), int(size * 0.22)
        right, bottom = int(size * 0.72), int(size * 0.78)
        fold = int(size * 0.12)
        if not (left <= x < right and top <= y < bottom):
            return False
        if x >= right - fold and y < top + fold:
            return (x - (right - fold)) + (y - top) >= fold
        return True

    def on_line(x, y):
        left = int(size * 0.36)
        for index, ratio in enumerate((0.40, 0.50, 0.60)):
            cy = int(size * ratio)
            half = max(1, round(size * 0.035)) // 2
            right = left + int(size * (0.22 if index < 2 else 0.12))
            if left <= x < right and abs(y - cy) <= half:
                return True
        return False

    teal = (15, 118, 110, 255)
    white = (255, 255, 255, 255)
    clear = (0, 0, 0, 0)
    for y in range(size):
        raw.append(0)
        for x in range(size):
            if not inside(x, y):
                raw.extend(clear)
            elif on_paper(x, y) and on_line(x, y):
                raw.extend(teal)
            elif on_paper(x, y):
                raw.extend(white)
            else:
                raw.extend(teal)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


for size in (16, 32, 48, 128):
    path = os.path.join(out, f"icon{size}.png")
    with open(path, "wb") as handle:
        handle.write(png(size))
    print(path, os.path.getsize(path))
