$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$wb = $xl.Workbooks.Open("C:\innolab\Kopie von Zielkundenliste_AI-Readiness_Sprint.xlsx")
foreach ($sheet in $wb.Sheets) {
    $path = "C:\innolab\sprint_$($sheet.Name).csv"
    $sheet.Copy()
    $xl.ActiveWorkbook.SaveAs($path, 6)
    $xl.ActiveWorkbook.Close($false)
    Write-Host "Exportiert: $path"
}
$wb.Close($false)
$xl.Quit()
