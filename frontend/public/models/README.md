# Human heart reference model

`hra-human-heart.glb` is the male heart from the Human Reference Atlas / HuBMAP
CCF 3D Reference Object Library, release v1.2 (2022). It is based on Visible Human
Male data from the U.S. National Library of Medicine.

Credit: Kristen Browne, Heidi Schlehlein, Bruce W. Herr II, Ellen M. Quardokus,
Andreas Bueckle, and Katy Börner. The reference models were created by Kristen
Browne for the NIAID 3D Printing and Biovisualization program.

- Original asset: <https://github.com/hubmapconsortium/ccf-releases/blob/main/v1.2/models/VH_M_Heart.glb>
- Official reference library and attribution: <https://humanatlas.io/3d-reference-library>
- Release v1.2 citation: <https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html>
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) (CC-BY-4.0)

The bundled GLB is unmodified. CARDIOTON adapts its display scale, orientation,
materials, tissue surface textures, and lighting in `RealisticHeart.tsx`.
Illustrative great vessels and coronary surface branches are added in code.
The model is general reference anatomy; those additions and the display motion
are illustrative and are not patient imaging or a physiological simulation.

`heart-reference-preview.png` is a transparent render of that adapted scene,
used while the model loads and when WebGL is unavailable. It has the same
source attribution and CC-BY-4.0 license.
