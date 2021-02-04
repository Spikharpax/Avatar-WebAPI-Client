Option explicit

Dim WshShell, objWMIService, objFSO
Dim sScriptPath
Dim iReturnValue
Dim Return

On Error Resume Next

Set WshShell = WScript.CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:{impersonationLevel=impersonate}")
Set objFSO = CreateObject( "Scripting.FileSystemObject" )

iReturnValue = -1
sScriptPath  = Replace(WScript.ScriptFullName, WScript.ScriptName, "")
' Launch Server and wait till it's completely launched
WScript.Sleep 10000
Return = WshShell.Run(sScriptPath & "AvatarWebAPIClient.exe", 1, True)

'-- Destroy objects
Set objWMIService = nothing
Set WshShell = nothing
Set objFSO = nothing

iReturnValue = 0
WScript.Quit(iReturnValue)

' include VBS librairies
Sub includeFile(fSpec)
    With CreateObject("Scripting.FileSystemObject")
       executeGlobal .openTextFile(fSpec).readAll()
    End With
End Sub
