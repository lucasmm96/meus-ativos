import sys
from pathlib import Path

_INGESTAO = Path(__file__).resolve().parents[1] / "ingestao"
if str(_INGESTAO) not in sys.path:
    sys.path.insert(0, str(_INGESTAO))
