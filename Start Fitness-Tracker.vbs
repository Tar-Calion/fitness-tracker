' Set this to your project folder
projectDir = "C:\Git\fitness-tracker"

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(projectDir & "\package.json") Then
  MsgBox "Project folder not found: " & projectDir, 16, "Fitness Tracker"
  WScript.Quit 1
End If

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = projectDir

If Not fso.FolderExists(projectDir & "\node_modules") Then
  shell.Run "cmd /c npm install", 0, True   ' 0 = hidden, True = wait
End If

' Start without waiting; Electron window appears
shell.Run "cmd /c npm start", 0, False
WScript.Quit 0
