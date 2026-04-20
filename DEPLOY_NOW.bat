@echo off
echo === Thep Academy - Deploying to GitHub Pages ===
echo.
cd /d "%~dp0"
if exist ".git\index.lock" del ".git\index.lock"
git rebase --abort 2>/dev/null
git merge --abort 2>/dev/null
git cherry-pick --abort 2>/dev/null
git add "index.html"
git add "kham.html"
git add "blog/index.html"
git add "blog/m1-5traps/index.html"
git add "blog/ordering-cafe/index.html"
git add "blog/essay/index.html"
git add "blog/ielts-task2/index.html"
git add "blog/skimming/index.html"
git add "mock-exam/index.html"
git add "grammar-foundation/index.html"
git add "pretest/index.html"
git add "courses/index.html"
git add "join/index.html"
git add "onet-vocab/index.html"
git add "tenses/index.html"
git add "assets/images/logo.png"
git add "assets/images/bom_photo.jpg"
git add "assets/images/course_moon.jpg"
git add "assets/images/banners/banner-pretest.png"
git add "assets/images/banners/banner-grammar.png"
git add "assets/images/banners/banner-ultimate.png"
git add "assets/images/banners/banner-mock-exam.png"
git add "assets/js/exam-timer.js"
git add "assets/js/exam-engine.js"
git add "assets/js/session-recovery.js"
git add "assets/data/questions.json"
git add "assets/data/onet_m3_vocab_500.json"
git add "sitemap.xml"
git add "robots.txt"
git add "docs/MockExam_M1_English_ThepAcademy.pdf"
git add "docs/MockExam_English_1000Q.docx.pdf"
git add "CLAUDE.md"
git add "DEPLOY_NOW.bat"
git add "backend/questions.json"
git add "backend/src/modules/exam/exam.routes.js"
git add "backend/src/modules/exam/exam.service.js"
git add "backend/src/app.js"
git add -u
git diff --cached --quiet && (echo Nothing new to commit. & goto PUSH)
git commit -m "Update website: instructor photo, SEO, blog posts, sitemap"
:PUSH
echo Syncing with GitHub...
git fetch origin main
git merge origin/main -X ours --no-edit 2>/dev/null
echo Pushing to GitHub...
git push origin main
echo.
if %ERRORLEVEL%==0 (echo === Done! Website will update in 1-2 minutes ===) else (echo === Push failed. Run: git push origin main ===)
echo Visit: https://thep-academy.com
pause
