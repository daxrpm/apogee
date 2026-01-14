from __future__ import annotations

import numpy as np

from .core import EquatorialOrbit
from .types import AttitudeSolution


def calculate_yaw_steering(orbit: EquatorialOrbit, t: float, sun_eci: tuple[float, float, float]) -> AttitudeSolution:
    """Calculate the optimal yaw steering angle for a given time and sun vector.
    
    The yaw steering law rotates the satellite about the Nadir axis (Z_lvlh) 
    such that the solar panels (assumed to rotate about the Body Y axis) 
    are perpendicular to the sun vector projected onto the Body X-Z plane.
    
    Args:
        orbit: EquatorialOrbit instance
        t: Time since epoch [s]
        sun_eci: Sun vector in ECI frame (does not need to be normalized, but direction matters)
    
    Returns:
        AttitudeSolution containing yaw angle, beta angle, and sun vector in body frame.
    """
    # 1. Normalize sun vector
    s_eci = np.array(sun_eci)
    s_norm = np.linalg.norm(s_eci)
    if s_norm < 1e-6:
        raise ValueError("Sun vector norm is too small")
    s_eci = s_eci / s_norm
    
    # 2. Get LVLH basis vectors (Transformation Matrix ECI -> LVLH)
    # Rows of the rotation matrix are the basis vectors expressed in ECI
    x_lvlh, y_lvlh, z_lvlh = orbit.get_lvlh_basis(t)
    
    # R_eci_to_lvlh = [x_lvlh^T; y_lvlh^T; z_lvlh^T]
    # s_lvlh = R * s_eci
    # Equivalent to dot products since basis is orthonormal
    sx_local = np.dot(s_eci, x_lvlh)
    sy_local = np.dot(s_eci, y_lvlh)
    sz_local = np.dot(s_eci, z_lvlh)
    
    # 3. Calculate Beta angle (elevation of sun above orbit plane)
    # The orbit plane normal is generally Y_lvlh for equatorial orbit? 
    # Wait, LVLH Y is South (-Z_epi). The orbit angular momentum is Z_epi (North).
    # Orbit normal (North) is -y_lvlh in this specific basis [0,0,-1]
    # Let's double check.
    # Orbit is in XY plane. Normal is Z_ECI [0,0,1].
    # LVLH Y is [0,0,-1]. So Normal is -Y_lvlh.
    # Beta = asin(s . n_orbit) = asin(s_eci . [0,0,1]) = asin(s_z_eci)
    # In local frame, Normal is -Y_lvlh (since Y_lvlh is South).
    # So beta = asin(-sy_local).
    beta = np.arcsin(-sy_local)
    
    # 4. Calculate Yaw Angle (psi)
    # We want to rotate around Z_lvlh (Nadir) by angle psi.
    # The Body frame (Xb, Yb, Zb) is related to LVLH (Xl, Yl, Zl) by:
    # [Xb]   [ cos(psi)   sin(psi)   0 ] [Xl]
    # [Yb] = [-sin(psi)   cos(psi)   0 ] [Yl]
    # [Zb]   [    0          0       1 ] [Zl]
    #
    # We want the sun vector in Body frame to have X component = 0 ??
    # No, typically for solar panels along Y-body, we want the sun to be in the X-Z plane 
    # (perpendicular to Y axis) OR we want to maximize Y component?
    #
    # Standard Yaw Steering: "The solar array axis (Body Y) is perpendicular to the Sun-Nadir plane."
    # Wait, usually solar panels rotate around Y-body axis.
    # To face the sun, the panel normal vector needs to point to the sun.
    # The panel normal vector rotates in the X-Z plane of the body.
    # So we want the sun vector to lie in the X-Z plane of the body? 
    # No, if the sun is in the X-Z plane, the panels (rotating around Y) can track it.
    # If the sun has a Y-component, that's cosine loss (Beta angle).
    # So we want to maximize the projection onto the X-Z plane? No, that's naturally done.
    #
    # Actually, the standard "Yaw Steering" law is defined to keep the Body-Y axis perpendicular to the Sun vector 
    # as much as possible, OR to keep the Body-Y axis perpendicular to the Sun-Nadir plane?
    #
    # Let's use the definition: Reference frame where Sun has no Y-component? No, Y is the axis of rotation for arrays.
    # If Y is axis of rotation, we can track any sun defined in X-Z plane.
    # So we want to rotate Body frame such that the Sun vector lies in the Body X-Z plane?
    # That would mean s_body_y = 0.
    #
    # Let's check:
    # s_body_y = -sin(psi)*sx_local + cos(psi)*sy_local
    # If we set s_body_y = 0:
    # sin(psi)*sx_local = cos(psi)*sy_local
    # tan(psi) = sy_local / sx_local
    # psi = atan2(sy_local, sx_local)
    #
    # IF we do this, then the sun vector has 0 component in Y-body.
    # But wait, if beta is non-zero, the sun DOES have a component out of the plane.
    # If the orbit is equatorial and sun is at solstice (beta=23.5), we can't zero out the Y component 
    # relative to the orbit plane.
    #
    # Let's re-read the user request: "calculate the yaw steering... that maximizes solar panel exposure".
    # Typically, with 1-axis SADA (Solar Array Drive Assembly) along Y, you yaw the S/C 
    # so that the Sun vector is "most perpendicular" to the Y axis?
    # No, you yaw so that the SADA axis (Y) is perpendicular to the Sun Vector ??
    # If Y is perp to Sun, then Sun lies in X-Z plane, and SADA can rotate panels to face sun perfectly.
    #
    # BUT we can't always do that if Beta is non-zero.
    # If Beta is 90 (Sun at Normal), Sun is along Z_ECI (Normal).
    # LVLH Y is -Z_ECI. So Sun is along -Y_lvlh.
    # Sun is [0, -1, 0] in LVLH.
    # s_body_y = -sin(psi)*0 + cos(psi)*(-1) = -cos(psi)
    # To make s_body_y = 0, we need cos(psi) = 0 -> psi = 90 deg.
    #
    # The standard law: $\psi = \arctan2(s_{y, local}, s_{x, local})$
    # Let's check this law.
    # If psi = atan2(sy, sx), then sin = sy/h, cos = sx/h.
    # s_body_y = -(sy/h)*sx + (sx/h)*sy = 0.
    #
    # So YES, this law rotates the frame so that the Sun Vector projects purely onto the Body X-Z plane.
    # This means the Y-axis (SADA axis) is perpendicular to the Sun projection?
    # Actually, it puts the Sun vector in the X-Z plane. 
    # Wait, if `s` has a generic `z_local` component, and we only rotate around Z, 
    # we can only affect X and Y components.
    #
    # If we ensure `s` lies in the X-Z plane, then the Y component is 0.
    # Is this physically possible?
    # `s_local` has components `sx, sy, sz`.
    # `s` is a unit vector.
    # We rotate around `z` (Nadir). `sz` is invariant.
    # The vector `[sx, sy]` rotates.
    # We want the rotated `y` component to be 0.
    # So we align the `x` axis with the `[sx, sy]` vector.
    # Yes, `psi = atan2(sy, sx)` aligns Body X with the horizontal projection of the Sun.
    # This leaves Body Y perpendicular to the sun's horizontal projection.
    #
    # So `s_body` will be `[sqrt(sx^2 + sy^2), 0, sz]`.
    # The Sun vector is in the X-Z plane.
    # The solar panels rotate around Y. Their normal can sweep the entire X-Z plane.
    # So they can perfectly track the sun vector `s_body` by rotating the panels.
    # PERFECT. This is the correct control law.
    
    psi = np.arctan2(sy_local, sx_local)
    
    # Calculate Sun in Body Frame to verify
    # Rotation Matrix B_from_L
    # [ cos   sin   0 ]
    # [ -sin  cos   0 ]
    # [  0     0    1 ]
    c_psi = np.cos(psi)
    s_psi = np.sin(psi)
    
    s_bx = c_psi * sx_local + s_psi * sy_local
    s_by = -s_psi * sx_local + c_psi * sy_local # Should be ~0
    s_bz = sz_local
    
    return AttitudeSolution(
        t=t,
        yaw=psi,
        beta=beta,
        sun_body=(s_bx, s_by, s_bz)
    )
