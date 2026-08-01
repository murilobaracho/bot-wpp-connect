' Inicia o painel sem abrir janela de terminal.
' Uso normal: dê duplo clique neste arquivo.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

shell.CurrentDirectory = projectDir
shell.Run "node src\server.js", 0, False
