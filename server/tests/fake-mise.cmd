@echo off
rem Windows wrapper: route the bash-based fake-mise fixture through Git Bash.
"C:Program FilesGitinash.exe" "%~dp0fake-mise.sh" %*
