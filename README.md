# Neutron–Xenon Scattering Explorer

Interactive elastic-scattering plots, two evaluated libraries (ENDF/B-VII.1 and
qualified JENDL-4.0u), a spherical optical model, saved Xe-132 OPTMAN examples,
and beginner physics explanations. A fifth interactive plot shows the signed
ENDF/B-VII.1 minus JENDL-4.0u elastic differential cross section, a constant
reference Δσ_el/(4π), and the solid-angle RMS about that reference. Energy and
target update it; the compound slider does not. Axes remain fixed with manual
zoom. This comparison does not identify a compound-elastic mechanism.

Website: https://sinochen1992.github.io/neutron-xenon-scattering/

## Use

Open the website to use the controls immediately. Download the Colab notebook
or use its launch link; its BASE_URL loads the same website assets. The complete
portable ZIP supports offline setup. A modern browser with gzip
DecompressionStream support is required. For local viewing, serve this folder
over localhost instead of opening index.html as a file.

## Publish

Publish this directory's contents from the main branch root using GitHub Pages.
Keep .nojekyll. The entry page is index.html and all data URLs are relative.
The website contains only the prepared teaching tool and public-source derived
data, with input hashes and source attribution; no research-repository history
or restricted Drive file link is part of this export.

## Data and scope

The shared gzip JSON is about 2.36 MB. The main notebook and this website use
identical scientific data and renderer templates. The manifest checks asset
integrity; it is not a publisher signature. Optional notebook cells expose
the display arrays and rerun the spherical DD baseline with NumPy and SciPy.

This is an approximate teaching grid, not a transport database. Unreconstructed
resonance ranges are masked, deep minima may have large relative interpolation
errors, and no shape/compound decomposition is claimed for the evaluations.
OPTMAN covers saved Xe-132 examples at 2.45 and 14.1 MeV only. Its compound
component is illustrative; POD is not included. The page explains the channel
accounting, recoil mapping, lower panels, and dip-versus-area diagnostics.

Figures generated for Chen Ding's tool from the cited public evaluations and
documented model inputs. Source URLs, hashes, and conventions are available
through the page's provenance download.
