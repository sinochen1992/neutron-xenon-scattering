"""Elastic neutron scattering on xenon from a nuclear optical model: angular distribution, recoil-energy spectrum and
partial waves. Reusable teaching tool for natural xenon and individual xenon isotopes.
Originally requested by Chen on 2026-10-23; independent tool home requested on 2026-10-24.

Physics. The neutron-nucleus interaction is the Koning-Delaroche (2003) global neutron optical potential: real and imaginary Woods-Saxon volume terms, an imaginary surface term and a spin-orbit term, with their
energy dependence. For each orbital angular momentum l and total j = l +- 1/2 the radial Schroedinger equation is
integrated outward (Numerov) and matched to free waves outside the nucleus, giving the S-matrix S_lj. From it:
    shape-elastic dsigma/dOmega = |f|^2 + |g|^2 (spin non-flip and spin-flip amplitudes),
    sigma_el, sigma_reaction, sigma_tot (checked against the optical theorem),
    recoil spectrum dsigma/dE_r = (4 pi / E_max) dsigma/dOmega_cm, with E_r = E_max (1 - cos theta_cm) / 2.
Compound-elastic scattering (absorption followed by re-emission of a neutron at full energy) is not computed: it needs
a Hauser-Feshbach calculation. It is nearly isotropic, so `compound_fraction` adds an illustrative isotropic term equal
to that fraction of the reaction cross section. Kinematics are non-relativistic (k changes by < 1% below 20 MeV).
Comparison models: a quantum black sphere (S_l = 0 for l <= kR, else 1) and classical hard spheres ("billiard balls",
isotropic in the centre-of-mass frame).
Units: MeV, fm; cross sections returned in barns (1 b = 100 fm^2).
"""
import numpy as np
from scipy import special

HBARC = 197.3269804      # MeV fm
MN = 939.56542           # neutron mass, MeV
AMU = 931.49410          # atomic mass unit, MeV
LAMBDA_PI2 = 2.0         # (hbar / m_pi c)^2, fm^2, Koning-Delaroche spin-orbit constant
Z_XE = 54
XE_NATURAL = {124: 0.00095, 126: 0.00089, 128: 0.01910, 129: 0.26401, 130: 0.04071,
              131: 0.21232, 132: 0.26909, 134: 0.10436, 136: 0.08857}   # IUPAC isotopic abundances


def kd_neutron(A, Z, E):
    """Koning-Delaroche (2003) global neutron potential at lab energy E (MeV): depths (MeV) and geometry (fm)."""
    asym, a13 = (A - 2 * Z) / A, A ** (1 / 3)
    v1, v2 = 59.30 - 21.0 * asym - 0.024 * A, 0.007228 - 1.48e-6 * A
    v3, v4 = 1.994e-5 - 2.0e-8 * A, 7.0e-9
    w1, w2 = 12.195 + 0.0167 * A, 73.55 + 0.0795 * A
    d1, d2, d3 = 16.0 - 16.0 * asym, 0.0180 + 0.003802 / (1 + np.exp((A - 156.0) / 8.0)), 11.5
    vso1, vso2, wso1, wso2 = 5.922 + 0.0030 * A, 0.0040, -3.1, 160.0
    f = E - (-11.2814 + 0.02646 * A)                       # energy above the Fermi energy
    return {"VV": v1 * (1 - v2 * f + v3 * f ** 2 - v4 * f ** 3), "WV": w1 * f ** 2 / (f ** 2 + w2 ** 2),
            "WD": d1 * f ** 2 * np.exp(-d2 * f) / (f ** 2 + d3 ** 2),
            "VSO": vso1 * np.exp(-vso2 * f), "WSO": wso1 * f ** 2 / (f ** 2 + wso2 ** 2),
            "RV": (1.3039 - 0.4054 / a13) * a13, "aV": 0.6778 - 1.487e-4 * A,
            "RD": (1.3424 - 0.01585 * a13) * a13, "aD": 0.5446 - 1.656e-4 * A,
            "RSO": (1.1854 - 0.647 / a13) * a13, "aSO": 0.59}


def kinematics(T, A):
    """Centre-of-mass wave number k (1/fm), CM energy (MeV), reduced mass (MeV) and maximum recoil energy (keV)."""
    M = A * AMU
    mu = MN * M / (MN + M)
    e_cm = T * M / (MN + M)
    return np.sqrt(2 * mu * e_cm) / HBARC, e_cm, mu, 4 * MN * M / (MN + M) ** 2 * T * 1e3


def potential(r, p, ls):
    """Complex optical potential U(r) (MeV) for channels with l.sigma = ls (array over channels, r scalar)."""
    fV = 1 / (1 + np.exp((r - p["RV"]) / p["aV"]))
    xD = np.exp((r - p["RD"]) / p["aD"])
    xS = np.exp((r - p["RSO"]) / p["aSO"])
    dfso = -(1 / p["aSO"]) * xS / (1 + xS) ** 2              # d f_SO / dr (negative)
    return (-(p["VV"] + 1j * p["WV"]) * fV - 4j * p["WD"] * xD / (1 + xD) ** 2
            + LAMBDA_PI2 * (p["VSO"] + 1j * p["WSO"]) * dfso / r * ls)


def s_matrix(T, A, Z=Z_XE, h=0.02, r_max=20.0, l_max=None, params=None):
    """S_lj for j = l + 1/2 (S_plus) and j = l - 1/2 (S_minus), l = 0..l_max; Numerov outward, two-point matching."""
    k, e_cm, mu, _ = kinematics(T, A)
    p = kd_neutron(A, Z, T) if params is None else params
    if l_max is None:
        l_max = int(np.ceil(k * (p["RV"] + 8 * p["aV"]))) + 6
    ls_ = np.arange(l_max + 1)
    lch = np.concatenate([ls_, ls_])                                  # channels: all j = l+1/2, then all j = l-1/2
    lsig = np.concatenate([ls_, -(ls_ + 1)]).astype(float)
    c = 2 * mu / HBARC ** 2
    n = int(round(r_max / h))
    r = h * np.arange(n + 1)

    def Q(ri):
        return lch * (lch + 1) / ri ** 2 + c * (potential(ri, p, lsig) - e_cm)

    u_prev, u_cur = (h ** (lch + 1)).astype(complex), ((2 * h) ** (lch + 1)).astype(complex)
    q_prev, q_cur = Q(r[1]), Q(r[2])
    store = {}
    i1 = n - int(round(2.0 / h))                                      # matching radii r_max - 2 fm and r_max
    for i in range(2, n):
        q_next = Q(r[i + 1])
        u_next = (2 * u_cur * (1 + 5 * h * h * q_cur / 12) - u_prev * (1 - h * h * q_prev / 12)) / (1 - h * h * q_next / 12)
        scale = np.maximum(np.abs(u_next), 1e-300)                    # keep numbers finite; ratios are what matter
        big = scale > 1e100
        if big.any():
            u_prev[big], u_cur[big], u_next[big] = u_prev[big] / scale[big], u_cur[big] / scale[big], u_next[big] / scale[big]
            if "u1" in store:
                store["u1"][big] /= scale[big]
        if i + 1 == i1:
            store["u1"] = u_next.copy()
        u_prev, u_cur, q_prev, q_cur = u_cur, u_next, q_cur, q_next
    r1, r2 = r[i1], r[n]
    rho = store["u1"] / u_cur

    def hpm(x):
        F = x * special.spherical_jn(lch, x)
        G = -x * special.spherical_yn(lch, x)
        return G + 1j * F, G - 1j * F

    hp1, hm1 = hpm(k * r1)
    hp2, hm2 = hpm(k * r2)
    S = (hm1 - rho * hm2) / (hp1 - rho * hp2)
    S_plus, S_minus = S[: l_max + 1], S[l_max + 1:].copy()
    S_minus[0] = S_plus[0]                                            # no j = l - 1/2 channel for l = 0
    return {"k": k, "l": ls_, "S_plus": S_plus, "S_minus": S_minus, "params": p}


def amplitudes(sm, theta):
    """Spin non-flip f and spin-flip g amplitudes (fm) at CM angles theta (rad)."""
    k, l, Sp, Sm = sm["k"], sm["l"], sm["S_plus"], sm["S_minus"]
    x = np.cos(theta)
    P = np.array([special.lpmv(0, li, x) for li in l])
    P1 = np.array([special.lpmv(1, li, x) for li in l])
    f = ((l + 1) * (Sp - 1) + l * (Sm - 1)) @ P / (2j * k)
    g = (Sp - Sm) @ P1 / (2j * k)
    return f, g


def cross_sections(sm):
    """Shape-elastic, reaction and total cross sections (b), per partial wave and summed."""
    k, l, Sp, Sm = sm["k"], sm["l"], sm["S_plus"], sm["S_minus"]
    el_l = np.pi / k ** 2 * ((l + 1) * np.abs(1 - Sp) ** 2 + l * np.abs(1 - Sm) ** 2) / 100
    re_l = np.pi / k ** 2 * ((l + 1) * (1 - np.abs(Sp) ** 2) + l * (1 - np.abs(Sm) ** 2)) / 100
    tot = 2 * np.pi / k ** 2 * np.sum((l + 1) * (1 - Sp.real) + l * (1 - Sm.real)) / 100
    return {"el_l": el_l, "re_l": re_l, "el": el_l.sum(), "re": re_l.sum(), "tot": tot}


def black_sphere(T, A, theta, R):
    """Quantum black sphere: S_l = 0 for l <= kR, 1 above; dsigma/dOmega (b/sr) at CM angles theta."""
    k = kinematics(T, A)[0]
    L = int(np.floor(k * R))
    x = np.cos(theta)
    f = sum((2 * li + 1) * special.lpmv(0, li, x) for li in range(L + 1)) * 1j / (2 * k)
    return np.abs(f) ** 2 / 100


def scattering(T, isotopes=None, compound_fraction=0.0, n_theta=721, n_er=600):
    """Everything the notebook plots, for one neutron energy T (MeV) and a target mix {A: weight} (default natural Xe).
    Recoil spectra are summed over isotopes on a common recoil-energy grid (each isotope ends at its own E_max)."""
    isotopes = XE_NATURAL if isotopes is None else isotopes
    wsum = sum(isotopes.values())
    theta = np.linspace(0, np.pi, n_theta)
    e_max_all = max(kinematics(T, A)[3] for A in isotopes)
    er = np.linspace(0, e_max_all, n_er)
    out = {"theta": theta, "er": er, "dsdo": np.zeros(n_theta), "dsdo_ce": np.zeros(n_theta),
           "dsdo_black": np.zeros(n_theta), "dsdo_hard": np.zeros(n_theta), "dsde": np.zeros(n_er),
           "dsde_ce": np.zeros(n_er), "dsde_black": np.zeros(n_er), "dsde_hard": np.zeros(n_er),
           "el": 0.0, "re": 0.0, "tot": 0.0, "el_l": None, "re_l": None}
    for A, w in isotopes.items():
        w = w / wsum
        sm = s_matrix(T, A)
        k, _, _, e_max = kinematics(T, A)
        f, g = amplitudes(sm, theta)
        d = (np.abs(f) ** 2 + np.abs(g) ** 2) / 100
        cs = cross_sections(sm)
        R = sm["params"]["RV"]
        d_ce = np.full(n_theta, compound_fraction * cs["re"] / (4 * np.pi))
        d_bl = black_sphere(T, A, theta, R)
        d_hs = np.full(n_theta, (R ** 2 / 4) / 100)                    # classical hard sphere, isotropic
        cos_from_er = 1 - 2 * er / e_max
        inside = er <= e_max
        for key, dd in (("dsdo", d), ("dsdo_ce", d_ce), ("dsdo_black", d_bl), ("dsdo_hard", d_hs)):
            out[key] += w * dd
            spec = np.zeros(n_er)
            spec[inside] = np.interp(np.arccos(np.clip(cos_from_er[inside], -1, 1)), theta, dd) * 4 * np.pi / e_max
            out[key.replace("dsdo", "dsde")] += w * spec
        for key in ("el", "re", "tot"):
            out[key] += w * cs[key]
        n_l = len(cs["el_l"])
        for key in ("el_l", "re_l"):
            acc = out[key] if out[key] is not None else np.zeros(0)
            m = max(len(acc), n_l)
            new = np.zeros(m)
            new[: len(acc)] += acc
            new[:n_l] += w * cs[key]
            out[key] = new
    A_mean = sum(A * w for A, w in isotopes.items()) / wsum
    k, _, _, e_max = kinematics(T, A_mean)
    e_max_lo = min(kinematics(T, A)[3] for A in isotopes)                # heaviest isotope's endpoint
    p = kd_neutron(A_mean, Z_XE, T)
    dips = local_minima(er, out["dsde"], 0.03 * e_max_lo, 0.97 * e_max_lo)
    out.update({"T": T, "k": k, "lambda_bar": 1 / k, "R": p["RV"], "kR": k * p["RV"], "e_max": e_max,
                "e_max_range": (e_max_lo, e_max_all), "params": p, "A_mean": A_mean,
                "dips_keV": dips, "first_min_keV": dips[0] if dips else None})
    return out


def local_minima(er, spec, lo, hi):
    """Local minima of a recoil spectrum between lo and hi (keV). The upper bound stays below the heaviest isotope's
    endpoint, so the steps where the isotopes' spectra end (71.6-78.4 keV for natural Xe at 2.45 MeV) are not counted."""
    idx = np.where((er > lo) & (er < hi))[0]
    return [float(er[i]) for i in idx[1:-1] if spec[i] < spec[i - 1] and spec[i] <= spec[i + 1]]
