# VENDOR-NOTICE

Vendor de skills de terceiros do harness. Gerado por `scripts/vendor-skills.mjs`.
Politica de licenca P-02=(i): skill sem licenca identificavel NAO e vendorizada (fail-closed).
A copia e byte-identica a fonte; o drift (skill ou `LICENSE-<slug>` agregado) e barrado por `node scripts/vendor-skills.mjs --check`.

## Fontes (proveniencia)

| source | sourceType | sourceCommit | SPDX | licenseFile |
|---|---|---|---|---|
| dart-lang/skills | github | 0d9f1c4a0ae29d6f5180bf6143d7997ec3bacf49 | BSD-3-Clause | LICENSE-dart-lang-skills |
| flutter/skills | github | 0ef3972f93e2baa4156ba1cbb1e515cd53079c68 | BSD-3-Clause | LICENSE-flutter-skills |

## Licencas (texto completo + copyright)

As licencas abaixo vivem no repositorio upstream, nao no dir da skill
(por isso o `licenseFile` da skill aponta para o arquivo agregado).
O vendor grava cada uma na raiz deste diretorio, byte-a-byte (sem
newline final, como no upstream); o `--check` recomputa o sha256 e
falha se o arquivo divergir ou faltar.

### dart-lang/skills — BSD-3-Clause (`LICENSE-dart-lang-skills`)

```text
Copyright 2012, the Dart project authors.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### flutter/skills — BSD-3-Clause (`LICENSE-flutter-skills`)

```text
Copyright 2026 The Flutter Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Skills vendorizadas (22)

| skill | source | stacks | computedHash | treeHash |
|---|---|---|---|---|
| dart-add-unit-test | dart-lang/skills | dart | 326a2b6cb57bcb4f40203e063a1060e9549a8cea0ece1a5c9a0d39a2f2b85bc8 | ca966dcf20f38b27ef6fc48a55b8c27cb7705127e03b7a5c78d36ea146fc266e |
| dart-build-cli-app | dart-lang/skills | dart | 2c693ba718e23155fd9acd8d2e14f5c311258ed900131b2ad12fda46ae5eebfa | 9c88873c3404f2afa386ef9e9c7dd181c052ced38aa1b8e9f4814c685a49c5a5 |
| dart-collect-coverage | dart-lang/skills | dart | 36d77c4ebc2edc7ade399ae8461776dd33a461899afda4b2b9d8e7f599d2ef6c | fca566d09e82d45c7acbd8c4e85a38487c0f813b7919893f4bc7066ca03a33f2 |
| dart-fix-runtime-errors | dart-lang/skills | dart | 7b13cb0df76693d8c798432a1f86325b093a35e9687f231a012763fcad54fb2c | 5e389fb7035cc36177318dfccaf047eaf222946930f0e24844ab1281a9601800 |
| dart-generate-test-mocks | dart-lang/skills | dart | 7bf12a98d63e96ed51ba077a24426be1b11a9fc508f7dfca60fc6e118c3fc923 | c8a6732810c81d861aae6eacea0e02097942f752dc9f63ea318aa838253cc729 |
| dart-migrate-to-checks-package | dart-lang/skills | dart | 00b7fa026dcf004421650f20147d020244886321f715ff57ee38a96b3a9945bc | 601c6e0201db0ed1b92a5fb3f21e65e97dcc0b4ce420e4a2036ef46e20d60d53 |
| dart-resolve-package-conflicts | dart-lang/skills | dart | e25c789387152d9d0c437610caa5746e337a789bcb8e9c9887b0425b94b734ef | e21ffd909306c9d7e0d9a9a207e4383c8c372c9e080ed9b23ffdff822b8f86f4 |
| dart-run-static-analysis | dart-lang/skills | dart | e64ea092e216ecdc9b4a8b49b06d0b9a0b49f680c1116ada1d247b2de3fa6fe1 | e2a7454ac22d69d6c6ccb3d1c4c5e2da56c846d0a4c9699bbd33827936bec4f4 |
| dart-setup-ffi-assets | dart-lang/skills | dart | c27f5a4e79a4f291e09a9cfeab2842bb04d3570bb64c56bf309e573c3f244ef8 | ae72ba6a8253362a100d31d471ad70e9bae0128e8150b1541dedaafb3209cb81 |
| dart-use-ffigen | dart-lang/skills | dart | 688ec3e0218b3a96437916be5bdcaea87fe4f90ba869c3deec2f3392f1c6b626 | d0f26d683f54589a6c44bf599d5c37dd4862c7d2a9befe6862167c421355fec8 |
| dart-use-pattern-matching | dart-lang/skills | dart | 86ea49e8f82ebcdbfd00579c0bcaca16d3f33839c96f9d3875bee95c553daa4b | 08dcca251379e52a84ec7b2206518208c563b86ab72f29056ff2c54619d6ebe1 |
| dart-use-primary-constructors | dart-lang/skills | dart | 7cf85926f3de62ed9357d4f1f58da3762ebba5850308945a4836114e6ac0b048 | 0f919b00d2f9b57cb27207782888feb2c9117f3b2b5466bd63a159ca4f20be78 |
| flutter-add-integration-test | flutter/skills | flutter | 9ead37fef54371fed6ad07a9ba3de7a908135a0867b05baf74c28b7095343999 | 62eb6600a25156b09012ff5c1b5897fc4e02e9dbb1a1a8d3bc80fbce0d8fb345 |
| flutter-add-widget-preview | flutter/skills | flutter | 1b59c009558aab7a8e4b7b101fbe535b06054c0672780e9cea7e5c98a9c48dc4 | d015fd19a06b7c9f42e65add3e90fd51095cd6cb11f2b57c5d6bf759483b4f9a |
| flutter-add-widget-test | flutter/skills | flutter | c4f263c59cfe331ef42dba2aa81e25142aa4f7284518907c6b847e04502676b0 | bc03a884d80821350ce6298b0f528e27af1fe70733f8d8717fb84129750666b6 |
| flutter-apply-architecture-best-practices | flutter/skills | flutter | 2b1b63214d6b153c50aacd4bbcb76ce91dece449de9e06f477f8aad3163d667f | 7d8ae28831dcf0bf1d5968e0ef79218e2994d68f2463a5ef1e96f4c51c77b489 |
| flutter-build-responsive-layout | flutter/skills | flutter | f762ea2ee83d4f1f35d9093b41d2520dd024ab80c9539d4860b9ae7f2a4dc6a0 | f77247468631edb171477f808da95151dd19ce0164001ca57df3e38f912be6b2 |
| flutter-fix-layout-issues | flutter/skills | flutter | 1aaba922c951159118f9b141788f7bb7b8167bdc0bd5c6f0738ebb90c29b9532 | 85570f8ea12d4e1f3a2b2d6622c51b144a4df2697779633e67c2c23558f5946c |
| flutter-implement-json-serialization | flutter/skills | flutter | 0eed26f25308d78c6a9036ec936db93342f064d64f2cbac5e0e8648ba6b9db3f | 4a3198b5f1949c9bb5fc72466373b23ca7cf3b32ab92a44af51f2dec0348d49a |
| flutter-setup-declarative-routing | flutter/skills | flutter | 2341440c8bce0f176663695eaa71f9f7d7c967772a1dcd0d833c9778504b227e | 7d9c8b9d144b4064886b497b62968627fab7615e441fc67d95bfec7fc50e5c4a |
| flutter-setup-localization | flutter/skills | flutter | 671bf254ca8f3172b6bda5287d9e756e9fd5b49165a815f710c5b707ebaa38f8 | 33bfbdfb46d39c2acba559ab0b1b8d28a51c6a7ff3f6e0367f3b3cd46086cc92 |
| flutter-use-http-package | flutter/skills | flutter | 17efcf4da9933afaf9c1d41940bd6b92f1ae73dcae4bf6c59cfe24f7e487ee9f | 7400a1e1f5424fd85a99e1d57dc1946761e4768a0c3ac5accf20d2e896ba03c1 |

## Skills excluidas (0)

| skill | motivo |
|---|---|

## Revisao de conteudo (S1/S4)

Arquivos vendorizados: 22. Conteudo executavel: 0. Symlinks: 0.
