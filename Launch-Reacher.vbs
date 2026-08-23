' Launch-Reacher.vbs — always run the LATEST Reacher.
' Runs `npm start` (build + electron) from the project so a click always rebuilds
' from source and never launches a stale packaged copy. The build runs hidden;
' the app window appears when it finishes (first launch after edits takes ~30-60s).
Dim sh, fso, projectDir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' The project directory is wherever this script lives.
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = projectDir
' 0 = hidden console; False = don't wait. Electron opens its own window.
sh.Run "cmd /c npm start", 0, False
