Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Huihui Desktop')
$synth.Rate = 0

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path (Split-Path -Parent $scriptDir) "assets\video_audio"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force }

$lines = @(
  @{ id='scene1'; text='你是否遇到过，不同 AI 换个窗口就忘记规约、反复返工？项目的最佳实践经验，总是难以在智能体之间高效传承？' },
  @{ id='scene2'; text='告别繁琐文档！开工只需一句话，新 Agent 即可秒级对齐历史规约，严格遵守避坑清单与核心开发铁律。' },
  @{ id='scene3'; text='项目完工，同样只需一句话，全自动提炼破局经验与步骤，云端秒级自愈合并入库，全程无需手动复制！' },
  @{ id='scene4'; text='更有神州鲲泰 FDE 开发者平台深度赋能，提供产业级智算与企业级落地支撑，让知识规约与算力底座双轮驱动。' },
  @{ id='scene5'; text='SOP 誊录馆，把复杂的留给智能体，你只用一句话。即刻访问，开启人机协同新范式！' }
)

foreach ($item in $lines) {
  $file = Join-Path $outDir ($item.id + ".wav")
  $synth.SetOutputToWaveFile($file)
  $synth.Speak($item.text)
  $synth.SetOutputToNull()
  Write-Host ("Generated: " + $file)
}
