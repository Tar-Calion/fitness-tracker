Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FileExists(projectDir & "\package.json") Then
  MsgBox "Project folder not found: " & projectDir, 16, "Fitness Tracker"
  WScript.Quit 1
End If

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = projectDir

electronPath = projectDir & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(electronPath) Then
  installResult = shell.Run("cmd /c npm install", 0, True)
  If installResult <> 0 Or Not fso.FileExists(electronPath) Then
    MsgBox "Installation fehlgeschlagen. Bitte npm install im Projektordner ausfuehren.", 16, "Fitness Tracker"
    WScript.Quit 1
  End If
End If

' Launch Electron directly, without the npm/Node/cmd startup chain.
shell.Run Chr(34) & electronPath & Chr(34) & " " & Chr(34) & projectDir & Chr(34), 0, False
WScript.Quit 0
