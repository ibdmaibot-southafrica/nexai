# NexAI Cron Setup Script
# This creates a free cron job on cron-job.org to run agents every 5 minutes
# Run this after signing up at https://console.cron-job.org/signup

Write-Host "=== NexAI Cron Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create a cron job to run your NexAI agents every 5 minutes."
Write-Host ""

$apiKey = Read-Host "Enter your cron-job.org API key (get it at https://console.cron-job.org/account)"
$apiUrl = "https://api.cron-job.org"

# Create the cron job
$body = @{
    url = "https://vercel-app-sigma-teal.vercel.app/api/cron/daily-agents"
    enabled = $true
    saveResponses = $true
    schedule = @{
        base = "interval"
        interval = 300  # 5 minutes in seconds
    }
    request = @{
        method = "GET"
    }
    jobHeaders = @(
        @{ name = "User-Agent"; value = "NexAI-Cron/1.0" }
    )
} | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "Creating cron job..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$apiUrl/jobs" -Method POST -Headers @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    } -Body $body

    if ($response.jobId) {
        Write-Host ""
        Write-Host "=== SUCCESS ===" -ForegroundColor Green
        Write-Host "Cron job created! Job ID: $($response.jobId)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your NexAI agents will now run every 5 minutes."
        Write-Host "Dashboard: https://vercel-app-sigma-teal.vercel.app"
        Write-Host ""
        Write-Host "To manage your cron job:" -ForegroundColor Cyan
        Write-Host "  https://console.cron-job.org/jobs/$($response.jobId)"
    } else {
        Write-Host "Unexpected response: $($response | ConvertTo-Json)" -ForegroundColor Red
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual setup instructions:" -ForegroundColor Yellow
    Write-Host "1. Go to https://console.cron-job.org/signup and create a free account"
    Write-Host "2. Go to https://console.cron-job.org/jobs and click 'Add Job'"
    Write-Host "3. Set URL to: https://vercel-app-sigma-teal.vercel.app/api/cron/daily-agents"
    Write-Host "4. Set schedule to: Every 5 minutes"
    Write-Host "5. Save and enable the job"
}
