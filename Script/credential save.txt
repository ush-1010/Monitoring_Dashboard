# Prompt for password once
$cred = Get-Credential -UserName "test.local\Administrator"

# Save securely to file (encrypted with DPAPI, only this user on this machine can read it)

$cred.Password | Export-Clixml "C:\Share_Details\RunAsPassword.xml"

#Write-Host "$($cred.Password)"

# Save username separately (optional)

"test.local\Administrator" | Out-File "C:\Share_Details\RunAsUser.txt"