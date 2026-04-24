import argostranslate.package
import argostranslate.translate
import argparse
import os
import sys

# Default pairs installed when no CLI args are given
LANGUAGE_PAIRS = [
    ("pt", "en", "Olá mundo"),       # Portuguese
    ("ja", "en", "こんにちは世界"),    # Japanese
    # ("es", "en", "Hola mundo"),    # Spanish
    # ("fr", "en", "Bonjour monde"), # French
    # ("de", "en", "Hallo Welt"),    # German
    # ("it", "en", "Ciao mondo"),    # Italian
    # ("ru", "en", "Привет мир"),    # Russian
    # ("zh", "en", "你好世界"),       # Chinese
    # ("ko", "en", "안녕하세요"),      # Korean
    # ("ar", "en", "مرحبا بالعالم"), # Arabic
    # ("nl", "en", "Hallo wereld"),  # Dutch
    # ("tr", "en", "Merhaba dünya"), # Turkish
    # ("pl", "en", "Witaj świecie"), # Polish
]

parser = argparse.ArgumentParser(
    description="Install Argos Translate language packs.",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog="""
examples:
  python setup_lang.py                        install default pairs from this file
  python setup_lang.py es                     install Spanish -> English
  python setup_lang.py es fr de               install multiple languages -> English
  python setup_lang.py es:fr                  install Spanish -> French
  python setup_lang.py es:fr ja:zh            install multiple custom pairs
  python setup_lang.py --file model.argosmodel  install from a local file (offline)
  python setup_lang.py --file *.argosmodel    install multiple local files
  python setup_lang.py --list                 show all available packages
  python setup_lang.py --installed            show installed packages
""",
)
parser.add_argument(
    "langs",
    nargs="*",
    metavar="LANG or FROM:TO",
    help="Language code(s) to install. Single code = X->en. Use FROM:TO for custom target.",
)
parser.add_argument("--list", action="store_true", help="List all available language packages.")
parser.add_argument("--installed", action="store_true", help="List installed language packages.")
parser.add_argument(
    "--file",
    nargs="+",
    metavar="PATH",
    help="Install directly from one or more local .argosmodel files (no internet needed).",
)

args = parser.parse_args()


def update_index():
    print("Updating package index...")
    argostranslate.package.update_package_index()
    return argostranslate.package.get_available_packages()


def install_pair(available, from_code, to_code):
    already = argostranslate.package.get_installed_packages()
    if any(p.from_code == from_code and p.to_code == to_code for p in already):
        print(f"  Already installed, skipping.")
        return True

    package = next(
        (p for p in available if p.from_code == from_code and p.to_code == to_code),
        None,
    )
    if package is None:
        print(f"  ERROR: No package found for {from_code} -> {to_code}.")
        return False

    print(f"  Downloading {package}...")
    argostranslate.package.install_from_path(package.download())
    return True


if args.file:
    for path in args.file:
        if not os.path.isfile(path):
            print(f"ERROR: File not found: {path}")
            sys.exit(1)
        print(f"Installing from {path} ...")
        argostranslate.package.install_from_path(path)
        print(f"  OK — installed.")
    print("\nAll done.")
    sys.exit(0)

if args.installed:
    installed = argostranslate.package.get_installed_packages()
    if not installed:
        print("No packages installed yet.")
    else:
        print(f"{'FROM':<8} {'TO':<8}")
        print("-" * 16)
        for p in sorted(installed, key=lambda x: x.from_code):
            print(f"{p.from_code:<8} {p.to_code:<8}")
    sys.exit(0)

if args.list:
    available = update_index()
    print(f"\n{'FROM':<8} {'TO':<8}")
    print("-" * 16)
    for p in sorted(available, key=lambda x: (x.from_code, x.to_code)):
        print(f"{p.from_code:<8} {p.to_code:<8}")
    sys.exit(0)

# Build the list of pairs to install
if args.langs:
    pairs = []
    for lang in args.langs:
        if ":" in lang:
            parts = lang.split(":")
            if len(parts) != 2 or not parts[0] or not parts[1]:
                print(f"ERROR: Invalid format '{lang}'. Use FROM:TO (e.g. es:fr).")
                sys.exit(1)
            pairs.append((parts[0], parts[1]))
        else:
            pairs.append((lang, "en"))
else:
    pairs = [(f, t) for f, t, _ in LANGUAGE_PAIRS]

available = update_index()

for from_code, to_code in pairs:
    print(f"\n[{from_code} -> {to_code}]")
    ok = install_pair(available, from_code, to_code)
    if ok and from_code != to_code:
        try:
            result = argostranslate.translate.translate("hello", from_code, to_code)
            print(f"  OK — test passed.")
        except Exception:
            print(f"  Installed but test translation failed (may need restart).")

print("\nAll done.")
