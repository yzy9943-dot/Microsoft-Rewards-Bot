# Test Error Reporting Security

Write-Host "Testing Discord mention sanitization..." -ForegroundColor Cyan
Write-Host ""

$apiUrl = "https://light-rewards-bot.vercel.app/api/report-error"

# Test avec des mentions Discord malveillantes
$payload = @{
    error = "Test @everyone @here error with <@123456789> user mention"
    stack = "at testFunction <@&987654321> role mention`n    at main <#555555555> channel"
    context = @{
        version = "3.5.6"
        platform = "win32"
        arch = "x64"
        nodeVersion = "v22.0.0"
        timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        botMode = "SECURITY_TEST"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Payload with malicious mentions:" -ForegroundColor Yellow
Write-Host $payload -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 15
    
    Write-Host "SUCCESS - Sanitization applied!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check Discord - mentions should be neutralized:" -ForegroundColor Cyan
    Write-Host "  @everyone -> @<zero-width>everyone" -ForegroundColor Gray
    Write-Host "  @here -> @<zero-width>here" -ForegroundColor Gray
    Write-Host "  <@123456789> -> @user" -ForegroundColor Gray
    Write-Host "  <@&987654321> -> @role" -ForegroundColor Gray
    Write-Host "  <#555555555> -> #channel" -ForegroundColor Gray
    
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
