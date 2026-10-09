Image format regression fixtures (generated locally, 2026-10-09)

All pictures are synthetic color regions. They contain no external artwork or
personal data. Source pattern: 12 x 8 pixels; first four columns red, upper
remaining region blue, lower remaining region transparent.

transparent.png: Python standard-library struct/zlib PNG encoder, RGBA8.
color.bmp: Python standard-library uncompressed 24-bit BMP writer; source alpha
is omitted. Bottom-up rows and a 40-byte BITMAPINFOHEADER.
animated.gif: Python standard-library GIF89a writer. Two 2 x 1 frames alternate
red and blue pixels, each with a 100 ms delay. NETSCAPE2.0 repeat extension.
orientation-base.jpg: macOS sips JPEG conversion of transparent.png.
orientation6.jpg: orientation-base.jpg plus a leading EXIF APP1 segment. It has
little-endian TIFF, one SHORT Orientation tag (0x0112), value 6. Stored size is
12 x 8. Displayed size is 8 x 12 after 90-degree clockwise orientation.
color.webp: ImageMagick lossless WebP conversion of transparent.png.
color.heic: macOS sips HEIC conversion of transparent.png (12 x 8).
color.avif: ffmpeg 9.0.2/libsvtav1 conversion, scaled to 64 x 64 for the encoder.

AVIF and HEIC tests probe browser Image.decode() directly before using the
editor. Unsupported decoders must still produce a recoverable editor error.
An editor failure is never used to declare a decoder unsupported. Original-copy
tests compare all bytes, including animation/EXIF data, against these fixtures.
