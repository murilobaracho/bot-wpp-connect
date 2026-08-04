' Inicia o painel sem abrir janela de terminal.
' Uso normal: dê duplo clique neste arquivo.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

shell.CurrentDirectory = projectDir

' Primeira vez (sem node_modules): instala as dependências com o terminal visível,
' pra dar pra acompanhar o progresso e ver eventuais erros.
If Not fso.FolderExists(projectDir & "\node_modules") Then
    shell.Run "cmd /c npm install", 1, True
End If

shell.Run "node src\server.js", 0, False
