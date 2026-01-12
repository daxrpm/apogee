"""Rocket launch simulator with Falcon 9 parameters.

Public API for FastAPI and other consumers.
"""

from .simulator import (
    simulate_to_orbit,
    solve_to_circular_orbit,
    LaunchResult,
)

__all__ = [
    "simulate_to_orbit",
    "solve_to_circular_orbit",
    "LaunchResult",
]
