"""Falcon 9 v1.2 FT default parameters.

Official data from SpaceX and literature values.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Falcon9Params:
    """Falcon 9 v1.2 FT vehicle parameters."""
    
    m0: float = 549_054.0
    thrust1: float = 7_686_000.0
    thrust2: float = 981_000.0
    isp1: float = 282.0
    isp2: float = 348.0
    t2_burn: float = 397.0
    m1_dry: float = 22_000.0
    m2_dry: float = 4_000.0
    interstage: float = 2_000.0
    diameter: float = 3.7


FALCON9_DEFAULT = Falcon9Params()
