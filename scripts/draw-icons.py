"""Render the home-screen adaptation of the Kapok Club flower. Requires Pillow."""
from math import cos, radians, sin
from pathlib import Path
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parents[1] / "public-assets"
image = Image.new("RGB", (1536, 1536), "#f8ebcf")
draw = ImageDraw.Draw(image)
ink = "#373e31"
center = (768, 768)
scale = 8.6


def point(x, y, angle=0):
    theta = radians(angle)
    return (round(center[0] + scale * (x * cos(theta) - y * sin(theta))),
            round(center[1] + scale * (x * sin(theta) + y * cos(theta))))


def cubic(start, first, second, end):
    points = []
    for step in range(33):
        t = step / 32
        u = 1 - t
        points.append(tuple(u**3 * a + 3*u*u*t * b + 3*u*t*t * c + t**3 * d
                            for a, b, c, d in zip(start, first, second, end)))
    return points


def oval(x, y, radius_x, radius_y, fill, outline=None, width=1):
    draw.ellipse([point(x-radius_x, y-radius_y), point(x+radius_x, y+radius_y)],
                 fill=fill, outline=outline, width=round(scale*width))


def line(points, color, width, angle=0):
    draw.line([point(x, y, angle) for x, y in points], fill=color,
              width=round(width * scale), joint="curve")


petal = (cubic((0, 0), (-17, -11), (-30, -36), (-22, -53)) +
         cubic((-22, -53), (-17, -64), (-8, -66), (-3, -61)) +
         cubic((-3, -61), (8, -71), (23, -60), (24, -45)) +
         cubic((24, -45), (26, -28), (12, -7), (0, 0)))
vein = cubic((-3, -12), (-9, -24), (-13, -33), (-13, -43))
for angle, color in [(-8, "#ee8b66"), (65, "#f09b74"), (139, "#e77c60"),
                     (209, "#f3946b"), (281, "#ed8666")]:
    draw.polygon([point(x, y, angle) for x, y in petal], fill=color)
    line(petal, ink, 2.4, angle)
    line(vein, "#ad513c", 1.6, angle)
    line(cubic((4, -15), (8, -22), (12, -31), (13, -37)), "#ad513c", 1.3, angle)

oval(0, 1, 12, 10, "#f0c465", ink, 1.9)
for x, y in [(-16, -9), (-9, -17), (-1, -22), (8, -19), (16, -14), (20, -5)]:
    line(cubic((x * .20, 2), (x * .45, -1), (x * .69, y * .66), (x, y)), ink, 1.55)
    oval(x, y, 2.1, 2.3, "#735634", ink, .6)

for side, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    image.resize((side, side), Image.Resampling.LANCZOS).save(output / name, optimize=True)
