#!/usr/bin/env bash
# ⚡ BOZOK TERMINAL MOBILE — GitHub yükleme scripti
#
# Kullanım:
#   1) GitHub'da boş repo oluştur (ör. "bozok-terminal-mobile")
#   2) Bu scripti repo URL'siyle çalıştır:
#        ./git-push.sh https://github.com/KULLANICI/bozok-terminal-mobile.git
#      (veya):  git remote add origin <URL>  &&  git push -u origin main
#
# Token gerekiyorsa: https://github.com/settings/tokens (repo scope)
#   git push https://KULLANICI:TOKEN@github.com/KULLANICI/bozok-terminal-mobile.git

set -e

REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  echo "Kullanım: ./git-push.sh <repo-URL>"
  echo "Örnek:    ./git-push.sh https://github.com/senin-kullanici/bozok-terminal-mobile.git"
  exit 1
fi

echo "→ remote ekleniyor..."
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "→ main dalına push ediliyor..."
git push -u origin main

echo ""
echo "✅ Push tamam! GitHub Actions otomatik APK derliyor:"
echo "   https://github.com/$(echo "$REPO_URL" | sed -E 's#https?://github.com/##; s#\.git$##')/actions"
echo ""
echo "💡 APK'yı indirmek için: Actions → 'Build Android APK' → Artifacts → bozok-terminal-apk"
echo "📦 Sürüm çıkarmak için:  git tag v1.0.0 && git push origin v1.0.0 (Release'e APK eklenir)"
