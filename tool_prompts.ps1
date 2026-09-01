Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$cmdFinish = @"
请阅读 https://dcn-autotest-team.github.io/sop/llms.txt 中的跨项目自动提交协议，帮我提炼刚才完成项目的 0-1 破局步骤与避坑 Never/Always 铁律，并在系统临时目录操作 https://github.com/dcn-autotest-team/sop.git 仓库，将 SOP 写入 library/ 对应分类，运行 node scripts/update-index.js 后直接 git push 推送到 GitHub，全程全自动完成，严禁让我手动复制！
"@

$cmdStart = @"
本项目启动前，请先阅读我的 SOP 最佳实践仓库 https://github.com/dcn-autotest-team/sop 的 INDEX.md，阅读最匹配的历史规范，严格遵守其中的 0-1 路径、避坑清单与 Never/Always 约束进行开发。
"@

$form = New-Object System.Windows.Forms.Form
$form.Text = "SOP 极简口令复制器"
$form.Size = New-Object System.Drawing.Size(560, 390)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)

# 标题标签
$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "SOP 自动化调度口令库"
$lblTitle.Font = New-Object System.Drawing.Font("Microsoft YaHei", 14, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$lblTitle.Location = New-Object System.Drawing.Point(25, 18)
$lblTitle.Size = New-Object System.Drawing.Size(500, 30)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "点击任意按钮即可秒速复制到剪贴板，直接粘贴给任意 Agent 即可执行"
$lblSub.Font = New-Object System.Drawing.Font("Microsoft YaHei", 9)
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$lblSub.Location = New-Object System.Drawing.Point(26, 48)
$lblSub.Size = New-Object System.Drawing.Size(500, 22)
$form.Controls.Add($lblSub)

# 状态提示标签
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text = "准备就绪：点击下方按钮一键复制"
$lblStatus.Font = New-Object System.Drawing.Font("Microsoft YaHei", 9, [System.Drawing.FontStyle]::Bold)
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$lblStatus.Location = New-Object System.Drawing.Point(26, 76)
$lblStatus.Size = New-Object System.Drawing.Size(500, 22)
$form.Controls.Add($lblStatus)

# 按钮 1：完工沉淀
$btnFinish = New-Object System.Windows.Forms.Button
$btnFinish.Text = "📋 场景一：【项目完工】一键沉淀到 GitHub"
$btnFinish.Font = New-Object System.Drawing.Font("Microsoft YaHei", 10, [System.Drawing.FontStyle]::Bold)
$btnFinish.Location = New-Object System.Drawing.Point(25, 108)
$btnFinish.Size = New-Object System.Drawing.Size(495, 65)
$btnFinish.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$btnFinish.ForeColor = [System.Drawing.Color]::White
$btnFinish.FlatStyle = "Flat"
$btnFinish.FlatAppearance.BorderSize = 0
$btnFinish.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnFinish.Add_Click({
    [System.Windows.Forms.Clipboard]::SetText($cmdFinish)
    $lblStatus.Text = "✅ [项目完工口令] 已复制到剪贴板！去发给 Agent 即可"
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
})
$form.Controls.Add($btnFinish)

# 按钮 2：新项目开工
$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = "📋 场景二：【新项目开工】调取并对齐历史 SOP"
$btnStart.Font = New-Object System.Drawing.Font("Microsoft YaHei", 10, [System.Drawing.FontStyle]::Bold)
$btnStart.Location = New-Object System.Drawing.Point(25, 185)
$btnStart.Size = New-Object System.Drawing.Size(495, 65)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnStart.Add_Click({
    [System.Windows.Forms.Clipboard]::SetText($cmdStart)
    $lblStatus.Text = "✅ [新项目开工口令] 已复制到剪贴板！去发给 Agent 即可"
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
})
$form.Controls.Add($btnStart)

# 按钮 3：打开云端网页
$btnWeb = New-Object System.Windows.Forms.Button
$btnWeb.Text = "🌐 打开云端知识库 (GitHub Pages)"
$btnWeb.Font = New-Object System.Drawing.Font("Microsoft YaHei", 9)
$btnWeb.Location = New-Object System.Drawing.Point(25, 265)
$btnWeb.Size = New-Object System.Drawing.Size(240, 40)
$btnWeb.BackColor = [System.Drawing.Color]::White
$btnWeb.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnWeb.FlatStyle = "Flat"
$btnWeb.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnWeb.Add_Click({
    [System.Diagnostics.Process]::Start("https://dcn-autotest-team.github.io/sop/")
})
$form.Controls.Add($btnWeb)

# 按钮 4：打开 GitHub 仓库
$btnRepo = New-Object System.Windows.Forms.Button
$btnRepo.Text = "📦 访问 GitHub 代码仓库"
$btnRepo.Font = New-Object System.Drawing.Font("Microsoft YaHei", 9)
$btnRepo.Location = New-Object System.Drawing.Point(280, 265)
$btnRepo.Size = New-Object System.Drawing.Size(240, 40)
$btnRepo.BackColor = [System.Drawing.Color]::White
$btnRepo.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnRepo.FlatStyle = "Flat"
$btnRepo.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnRepo.Add_Click({
    [System.Diagnostics.Process]::Start("https://github.com/dcn-autotest-team/sop")
})
$form.Controls.Add($btnRepo)

[void]$form.ShowDialog()
