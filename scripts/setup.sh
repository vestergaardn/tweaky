#!/usr/bin/env bash
set -euo pipefail
mkdir -p .vercel
echo '{"projectId":"prj_iSEY6T7q2WLsydOc2CgG2d3VaGF4","orgId":"team_XptMmQ4EtQjqcJd5Ez8BILuY","projectName":"tweaky"}' > .vercel/project.json
vercel env pull .env.local --yes
