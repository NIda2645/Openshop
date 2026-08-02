param(
    [Parameter(Mandatory = $true)]
    [int] $ProcessId,

    [Parameter(Mandatory = $true)]
    [string] $OutputRoot,

    [int] $WindowHandle = 0
)

$ErrorActionPreference = 'Stop'

function Add-NativeTypes {
    if ('OpenShopAudit.Native' -as [type]) { return }

    Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace OpenShopAudit {
    public static class Native {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsWindowEnabled(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetWindow(IntPtr hWnd, uint command);

        [DllImport("user32.dll")]
        public static extern IntPtr GetParent(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

        [DllImport("user32.dll")]
        public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

        [DllImport("user32.dll")]
        public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);

        [DllImport("user32.dll")]
        public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);

        [DllImport("user32.dll")]
        public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, EnumMonitorsProc callback, IntPtr data);

        public delegate bool EnumMonitorsProc(IntPtr monitor, IntPtr hdc, ref RECT rect, IntPtr data);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern IntPtr GetMenu(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern int GetMenuItemCount(IntPtr hMenu);

        [DllImport("user32.dll")]
        public static extern IntPtr GetSubMenu(IntPtr hMenu, int position);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetMenuString(IntPtr hMenu, uint item, StringBuilder text, int maxCount, uint flags);

        [DllImport("user32.dll")]
        public static extern uint GetMenuState(IntPtr hMenu, uint item, uint flags);

        [DllImport("shcore.dll")]
        public static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint x, out uint y);

        [DllImport("user32.dll")]
        public static extern uint GetDpiForWindow(IntPtr hWnd);

        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT rect, int size);

        [DllImport("user32.dll")]
        public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT placement);

        [DllImport("user32.dll")]
        public static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);

        [DllImport("user32.dll")]
        public static extern bool SystemParametersInfo(uint action, uint parameter, ref HIGHCONTRAST highContrast, uint flags);

        [DllImport("user32.dll")]
        public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("user32.dll")]
        public static extern IntPtr GetFocus();

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X, Y; }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct MONITORINFOEX {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWPLACEMENT {
            public int length;
            public int flags;
            public int showCmd;
            public POINT minPosition;
            public POINT maxPosition;
            public RECT normalPosition;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct GUITHREADINFO {
            public int cbSize;
            public int flags;
            public IntPtr hwndActive;
            public IntPtr hwndFocus;
            public IntPtr hwndCapture;
            public IntPtr hwndMenuOwner;
            public IntPtr hwndMoveSize;
            public IntPtr hwndCaret;
            public RECT rcCaret;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct HIGHCONTRAST {
            public int cbSize;
            public uint dwFlags;
            public IntPtr lpszDefaultScheme;
        }

        public const uint GW_OWNER = 4;
        public const uint GW_CHILD = 5;
        public const uint GW_HWNDNEXT = 2;
        public const uint MONITOR_DEFAULTTONEAREST = 2;
        public const uint SPI_GETHIGHCONTRAST = 0x0042;
        public const uint MENU_TEXT = 0x00000004;
        public const uint MF_SEPARATOR = 0x00000800;
        public const uint MF_DISABLED = 0x00000002;
        public const uint MF_GRAYED = 0x00000001;
        public const uint MF_CHECKED = 0x00000008;
        public const uint MF_BYPOSITION = 0x00000400;
        public const uint PROCESS_DPI_AWARENESS_CONTEXT_PER_MONITOR_V2 = unchecked((uint) -4);
    }
}
"@
}

function Get-Text([IntPtr] $Handle) {
    $builder = New-Object Text.StringBuilder 1024
    [OpenShopAudit.Native]::GetWindowText($Handle, $builder, $builder.Capacity) | Out-Null
    return $builder.ToString()
}

function Get-ClassName([IntPtr] $Handle) {
    $builder = New-Object Text.StringBuilder 256
    [OpenShopAudit.Native]::GetClassName($Handle, $builder, $builder.Capacity) | Out-Null
    return $builder.ToString()
}

function Convert-Rect($rect) {
    [ordered]@{
        left = [int] $rect.Left
        top = [int] $rect.Top
        right = [int] $rect.Right
        bottom = [int] $rect.Bottom
        width = [int] ($rect.Right - $rect.Left)
        height = [int] ($rect.Bottom - $rect.Top)
    }
}

function Get-RedactedPath([string] $Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    return [regex]::Replace($Path, 'C:\\Users\\[^\\]+', 'C:\\Users\\<redacted>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Get-WindowRecord([IntPtr] $Handle, [int] $OwnerProcessId) {
    [uint32] $windowProcessId = 0
    [OpenShopAudit.Native]::GetWindowThreadProcessId($Handle, [ref] $windowProcessId) | Out-Null
    if ($windowProcessId -ne $OwnerProcessId) { return $null }

    $windowRect = New-Object OpenShopAudit.Native+RECT
    $clientRect = New-Object OpenShopAudit.Native+RECT
    $extendedRect = New-Object OpenShopAudit.Native+RECT
    [OpenShopAudit.Native]::GetWindowRect($Handle, [ref] $windowRect) | Out-Null
    [OpenShopAudit.Native]::GetClientRect($Handle, [ref] $clientRect) | Out-Null
    [OpenShopAudit.Native]::DwmGetWindowAttribute($Handle, 9, [ref] $extendedRect, [Runtime.InteropServices.Marshal]::SizeOf($extendedRect)) | Out-Null

    $clientOrigin = New-Object OpenShopAudit.Native+POINT
    [OpenShopAudit.Native]::ClientToScreen($Handle, [ref] $clientOrigin) | Out-Null
    $monitor = [OpenShopAudit.Native]::MonitorFromWindow($Handle, [OpenShopAudit.Native]::MONITOR_DEFAULTTONEAREST)
    $monitorInfo = New-Object OpenShopAudit.Native+MONITORINFOEX
    $monitorInfo.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($monitorInfo)
    [OpenShopAudit.Native]::GetMonitorInfo($monitor, [ref] $monitorInfo) | Out-Null

    $threadId = [OpenShopAudit.Native]::GetWindowThreadProcessId($Handle, [ref] $windowProcessId)
    $guiInfo = New-Object OpenShopAudit.Native+GUITHREADINFO
    $guiInfo.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($guiInfo)
    $guiInfoResult = [OpenShopAudit.Native]::GetGUIThreadInfo($threadId, [ref] $guiInfo)

    $placement = New-Object OpenShopAudit.Native+WINDOWPLACEMENT
    $placement.length = [Runtime.InteropServices.Marshal]::SizeOf($placement)
    [OpenShopAudit.Native]::GetWindowPlacement($Handle, [ref] $placement) | Out-Null

    [ordered]@{
        hwnd = ('0x{0:X}' -f $Handle.ToInt64())
        hwnd_decimal = $Handle.ToInt64()
        pid = $windowProcessId
        title = Get-Text $Handle
        class_name = Get-ClassName $Handle
        visible = [bool] [OpenShopAudit.Native]::IsWindowVisible($Handle)
        enabled = [bool] [OpenShopAudit.Native]::IsWindowEnabled($Handle)
        owner_hwnd = ('0x{0:X}' -f ([OpenShopAudit.Native]::GetWindow($Handle, [OpenShopAudit.Native]::GW_OWNER)).ToInt64())
        parent_hwnd = ('0x{0:X}' -f ([OpenShopAudit.Native]::GetParent($Handle)).ToInt64())
        window_rect_px = Convert-Rect $windowRect
        extended_frame_rect_px = Convert-Rect $extendedRect
        client_rect_px = Convert-Rect $clientRect
        client_origin_screen_px = [ordered]@{ x = $clientOrigin.X; y = $clientOrigin.Y }
        monitor = [ordered]@{
            device_name = $monitorInfo.szDevice
            monitor_rect_px = Convert-Rect $monitorInfo.rcMonitor
            work_rect_px = Convert-Rect $monitorInfo.rcWork
            primary = (($monitorInfo.dwFlags -band 1) -ne 0)
        }
        dpi_for_window = [int] ([OpenShopAudit.Native]::GetDpiForWindow($Handle))
        window_state_show_command = [int] $placement.showCmd
        focused_hwnd = if ($guiInfoResult) { ('0x{0:X}' -f $guiInfo.hwndFocus.ToInt64()) } else { $null }
        active_hwnd = if ($guiInfoResult) { ('0x{0:X}' -f $guiInfo.hwndActive.ToInt64()) } else { $null }
    }
}

function Get-TargetWindows([IntPtr] $MainHandle, [int] $OwnerProcessId) {
    $handles = New-Object System.Collections.Generic.List[IntPtr]
    $handles.Add($MainHandle)
    $callback = [OpenShopAudit.Native+EnumWindowsProc] {
        param([IntPtr] $handle, [IntPtr] $data)
        [uint32] $windowProcessId = 0
        [OpenShopAudit.Native]::GetWindowThreadProcessId($handle, [ref] $windowProcessId) | Out-Null
        if ($windowProcessId -eq $OwnerProcessId) { $handles.Add($handle) }
        return $true
    }
    [OpenShopAudit.Native]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

    $childHandles = New-Object System.Collections.Generic.List[IntPtr]
    foreach ($top in @($handles)) {
        $childCallback = [OpenShopAudit.Native+EnumWindowsProc] {
            param([IntPtr] $handle, [IntPtr] $data)
            [uint32] $windowProcessId = 0
            [OpenShopAudit.Native]::GetWindowThreadProcessId($handle, [ref] $windowProcessId) | Out-Null
            if ($windowProcessId -eq $OwnerProcessId) { $childHandles.Add($handle) }
            return $true
        }
        [OpenShopAudit.Native]::EnumChildWindows($top, $childCallback, [IntPtr]::Zero) | Out-Null
    }
    foreach ($child in @($childHandles)) { if (-not $handles.Contains($child)) { $handles.Add($child) } }

    return @($handles | Select-Object -Unique)
}

function Get-NativeMenu([IntPtr] $MenuHandle, [string[]] $Path, [int] $OwnerProcessId) {
    if ($MenuHandle -eq [IntPtr]::Zero) { return @() }
    $count = [OpenShopAudit.Native]::GetMenuItemCount($MenuHandle)
    $items = New-Object System.Collections.Generic.List[object]
    for ($position = 0; $position -lt $count; $position++) {
        $text = New-Object Text.StringBuilder 512
        [OpenShopAudit.Native]::GetMenuString($MenuHandle, [uint32] $position, $text, $text.Capacity, [OpenShopAudit.Native]::MENU_TEXT -bor [OpenShopAudit.Native]::MF_BYPOSITION) | Out-Null
        $state = [OpenShopAudit.Native]::GetMenuState($MenuHandle, [uint32] $position, [OpenShopAudit.Native]::MF_BYPOSITION)
        $subMenu = [OpenShopAudit.Native]::GetSubMenu($MenuHandle, $position)
        $label = $text.ToString()
        $currentPath = @($Path + $label)
        $items.Add([ordered]@{
            menu_path = $currentPath
            menu_position = $position
            label = $label
            separator = (($state -band [OpenShopAudit.Native]::MF_SEPARATOR) -ne 0)
            enabled = (($state -band ([OpenShopAudit.Native]::MF_DISABLED -bor [OpenShopAudit.Native]::MF_GRAYED)) -eq 0)
            checked = (($state -band [OpenShopAudit.Native]::MF_CHECKED) -ne 0)
            has_submenu = ($subMenu -ne [IntPtr]::Zero)
            source = 'Win32 GetMenu/GetSubMenu/GetMenuString'
        })
        if ($subMenu -ne [IntPtr]::Zero) {
            foreach ($child in @(Get-NativeMenu $subMenu $currentPath $OwnerProcessId)) { $items.Add($child) }
        }
    }
    return @($items)
}

function Get-EnvironmentSnapshot {
    $highContrast = New-Object OpenShopAudit.Native+HIGHCONTRAST
    $highContrast.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($highContrast)
    $highContrastAvailable = [OpenShopAudit.Native]::SystemParametersInfo([OpenShopAudit.Native]::SPI_GETHIGHCONTRAST, 0, [ref] $highContrast, 0)

    $monitors = New-Object System.Collections.Generic.List[object]
    $monitorCallback = [OpenShopAudit.Native+EnumMonitorsProc] {
        param([IntPtr] $monitor, [IntPtr] $hdc, [ref] $rect, [IntPtr] $data)
        $info = New-Object OpenShopAudit.Native+MONITORINFOEX
        $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)
        if ([OpenShopAudit.Native]::GetMonitorInfo($monitor, [ref] $info)) {
            $dpiX = 0; $dpiY = 0
            $dpiResult = [OpenShopAudit.Native]::GetDpiForMonitor($monitor, 0, [ref] $dpiX, [ref] $dpiY)
            $monitors.Add([ordered]@{
                device_name = $info.szDevice
                monitor_rect_px = Convert-Rect $info.rcMonitor
                work_rect_px = Convert-Rect $info.rcWork
                primary = (($info.dwFlags -band 1) -ne 0)
                dpi_for_monitor_x = if ($dpiResult -eq 0) { $dpiX } else { $null }
                dpi_for_monitor_y = if ($dpiResult -eq 0) { $dpiY } else { $null }
                dpi_source_hresult = $dpiResult
            })
        }
        return $true
    }
    [OpenShopAudit.Native]::EnumDisplayMonitors([IntPtr]::Zero, [IntPtr]::Zero, $monitorCallback, [IntPtr]::Zero) | Out-Null

    $culture = Get-Culture
    $uiCulture = Get-UICulture
    $systemLocale = try { (Get-WinSystemLocale).Name } catch { $null }
    [ordered]@{
        captured_at_utc = [DateTime]::UtcNow.ToString('o')
        os_caption = (Get-CimInstance Win32_OperatingSystem).Caption
        os_version = (Get-CimInstance Win32_OperatingSystem).Version
        os_build = (Get-CimInstance Win32_OperatingSystem).BuildNumber
        architecture = $env:PROCESSOR_ARCHITECTURE
        powershell_version = $PSVersionTable.PSVersion.ToString()
        locale = $culture.Name
        ui_locale = $uiCulture.Name
        system_locale = $systemLocale
        date_format = $culture.DateTimeFormat.ShortDatePattern
        time_format = $culture.DateTimeFormat.ShortTimePattern
        decimal_separator = $culture.NumberFormat.NumberDecimalSeparator
        thousands_separator = $culture.NumberFormat.NumberGroupSeparator
        currency_symbol = $culture.NumberFormat.CurrencySymbol
        first_day_of_week = $culture.DateTimeFormat.FirstDayOfWeek.ToString()
        time_zone = [TimeZoneInfo]::Local.Id
        high_contrast_enabled = if ($highContrastAvailable) { (($highContrast.dwFlags -band 1) -ne 0) } else { $null }
        monitor_count = $monitors.Count
        monitors = @($monitors)
        interactive_user = '<redacted by policy>'
        text_scaling = 'UNKNOWN: not changed or inferred from a single registry value'
        windows_theme = 'UNKNOWN: not required for the read-only baseline'
    }
}

Add-NativeTypes
$dpiContext = [OpenShopAudit.Native]::SetProcessDpiAwarenessContext([IntPtr](-4))
$process = Get-Process -Id $ProcessId -ErrorAction Stop
if ($process.HasExited) { throw "Target process exited before baseline capture." }

$main = if ($WindowHandle -ne 0) { [IntPtr] $WindowHandle } else { [IntPtr] $process.MainWindowHandle }
if ($main -eq [IntPtr]::Zero) { throw "Target process has no main window handle." }
[uint32] $windowPid = 0
[OpenShopAudit.Native]::GetWindowThreadProcessId($main, [ref] $windowPid) | Out-Null
if ($windowPid -ne $ProcessId) { throw "Window handle does not belong to the requested process." }

$root = [IO.Path]::GetFullPath($OutputRoot)
$subdirs = @('environment','application','windows','screens\screen-specs','evidence\process','evidence\window-trees','evidence\ui-automation','evidence\measurements','evidence\screenshots\windows','evidence\screenshots\client-areas')
foreach ($subdir in $subdirs) { New-Item -ItemType Directory -Force -Path (Join-Path $root $subdir) | Out-Null }

$processRecord = [ordered]@{
    captured_at_utc = [DateTime]::UtcNow.ToString('o')
    process_id = $process.Id
    process_name = $process.ProcessName
    main_window_handle = ('0x{0:X}' -f $main.ToInt64())
    main_window_title = $process.MainWindowTitle
    responding = $process.Responding
    has_exited = $process.HasExited
    executable_path_redacted = Get-RedactedPath $process.Path
    command_line = '<not collected: credentials/tokens must not enter evidence>'
    parent_process = '<not collected in this read-only pass>'
    architecture = '<not asserted from process memory or static analysis>'
}

$windows = foreach ($handle in @(Get-TargetWindows $main $ProcessId)) {
    Get-WindowRecord $handle $ProcessId
}
$windows = @($windows | Where-Object { $_ -ne $null })

$foreground = [OpenShopAudit.Native]::GetForegroundWindow()
[uint32] $foregroundPid = 0
[OpenShopAudit.Native]::GetWindowThreadProcessId($foreground, [ref] $foregroundPid) | Out-Null
$foregroundRecord = [ordered]@{
    hwnd = ('0x{0:X}' -f $foreground.ToInt64())
    process_id = $foregroundPid
    title = if ($foreground -ne [IntPtr]::Zero) { Get-Text $foreground } else { $null }
    belongs_to_target = ($foregroundPid -eq $ProcessId)
}

$menuItems = @(Get-NativeMenu ([OpenShopAudit.Native]::GetMenu($main)) @('native-menu') $ProcessId)
$environment = Get-EnvironmentSnapshot

$processRecord | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $root 'evidence\process\000_initial_process.json')
$windows | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $root 'evidence\window-trees\000_initial_win32_windows.json')
$environment | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $root 'environment\windows-environment.json')
([ordered]@{
    captured_at_utc = $environment.captured_at_utc
    foreground = $foregroundRecord
    target_window = Get-WindowRecord $main $ProcessId
    dpi_context_set = [bool] $dpiContext
    visual_capture = 'NOT_PERFORMED: current document content authorization is UNKNOWN and the target remains on the user desktop'
}) | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $root 'screens\screen-specs\000_initial_untouched.json')

$menuItems | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $root 'evidence\process\000_initial_native_menu.json')
$menuItems | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $root 'tools\native-menu-items.csv')

Write-Output ([ordered]@{
    output_root = $root
    process_id = $ProcessId
    main_window = ('0x{0:X}' -f $main.ToInt64())
    window_count = $windows.Count
    native_menu_item_count = $menuItems.Count
    foreground_process_id = $foregroundPid
    foreground_belongs_to_target = ($foregroundPid -eq $ProcessId)
    monitor_count = $environment.monitor_count
} | ConvertTo-Json -Compress)
