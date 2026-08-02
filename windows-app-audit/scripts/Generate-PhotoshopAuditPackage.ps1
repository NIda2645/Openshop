param([string]$Root = "Z:\Openshop\windows-app-audit")
$ErrorActionPreference = "Stop"
function Add-Text {
    param([string]$RelativePath,[string]$Content)
    $path = Join-Path $Root $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    [IO.File]::WriteAllText($path,$Content,[Text.UTF8Encoding]::new($false))
}
@("environment","application","screens\screen-specs","windows","flows","tools\specifications","design","behavior","data","accessibility","performance","testing","planning") |
    ForEach-Object { New-Item -ItemType Directory -Force -Path (Join-Path $Root $_) | Out-Null }

Add-Text "README.md" @'
# Openshop Windows Application Audit

Black-box audit of the live Adobe Photoshop CS6 64-bit desktop application on XRAY-PC,
captured 2026-08-01. Scope: visible shell, menus, docked panels, toolbar/tool flyouts,
window identity, safe navigation, accessibility surface, and reconstruction needs.

The target had no open document. Document-dependent editing, file I/O, clipboard,
printing, filters, destructive actions, and persistent settings were not exercised.
Screenshots are audit evidence only, not replacement UI assets. No Openshop
implementation was started.

Classifications used throughout: CONFIRMED, STRONG_INFERENCE, POSSIBLE, UNKNOWN,
UNTESTED. Tool statuses follow the supplied audit brief.
'@

Add-Text "audit-summary.md" @'
# Audit summary

## Target

CONFIRMED live target: Adobe Photoshop CS6, Version 13.0 x64, Photoshop.exe,
ProductVersion CS6, FileVersion 13.0 (13.0 20120315.r.428 2012/03/15:21:00:00).
The process was responding, PID 27004, main HWND 6884148, title Adobe Photoshop CS6.
No document was open.

## Coverage

The shell was inspected; File, Edit, Image, Layer, Type, Select, Filter, View, Window,
and Help menus were opened; safe submenus were recorded; the left toolbox and every
visible grouped tool flyout were cataloged. The final state was restored to the
Rectangular Marquee tool with no popup open.

The blank-document state disables most document commands. No scratch document was
created because this audit did not require one and the user required open work to stay
untouched. Canvas, layers, file I/O, filters, printing, clipboard, license, and
persistent settings remain untested or blocked.

## Findings

1. This is a classic Win32 desktop executable with no observed package identity.
2. The shell is a maximized dark workspace with menu bar, options bar, two-column
   left toolbox, right docked panels, bottom Mini Bridge/Timeline tabs, and Essentials
   workspace selector.
3. Tool flyouts are owner-drawn or otherwise weakly exposed to UI Automation; live
   screenshots are authoritative for those labels.
4. Persistent shell chrome remains visible in the empty state while document commands
   are disabled.
5. About Photoshop was visually present but did not enumerate as a second top-level
   window.

Evidence: evidence/screenshots/windows/000_initial_untouched.jpg,
evidence/screenshots/windows/002_final_restored_baseline.jpg, menu captures 009 through
041, and tool captures 100 through 118. Do not begin a rebuild until the user says
BEGIN REBUILD.

Each cataloged tool now has a purpose description in tools/tool-catalog.csv and a
human-readable explanation in tools/tool-details.md. Sources and the distinction
between researched purpose and live-tested behavior are recorded in
tools/tool-research-sources.md.
'@

Add-Text "environment/windows-environment.json" @'
{
  "classification": "CONFIRMED",
  "capturedOn": "2026-08-01",
  "machine": "XRAY-PC",
  "operatingSystem": "Microsoft Windows NT 10.0.26200.0",
  "architecture": "64-bit",
  "culture": "en-US",
  "shortDatePattern": "M/d/yyyy",
  "longTimePattern": "h:mm:ss tt",
  "timeZone": "Eastern Standard Time",
  "displayCount": 2,
  "packageIdentity": "none observed; classic executable"
}
'@
Add-Text "environment/display-and-dpi.md" @'
# Display and DPI observations

CONFIRMED: DISPLAY1 is primary at 1920x1080 with 1032px working-area height.
DISPLAY5 is secondary at 1920x1080 with 1032px working-area height. The Photoshop
window screenshot region was 1728x929 with origin 57,30.

UNKNOWN: exact Photoshop DPI-awareness mode and internal scaling policy. Treat live
measurements as observation values, and test the reconstruction at 100% and 125%
Windows scaling with per-monitor-v2-aware layout.
'@
Add-Text "environment/monitor-layout.json" @'
{
  "classification": "CONFIRMED",
  "monitors": [
    {"device": "\\\\.\\DISPLAY1", "primary": true, "x": 0, "y": 0, "width": 1920, "height": 1080, "workingAreaHeight": 1032},
    {"device": "\\\\.\\DISPLAY5", "primary": false, "x": 1920, "y": 0, "width": 1920, "height": 1080, "workingAreaHeight": 1032}
  ]
}
'@
Add-Text "environment/regional-settings.md" @'
# Regional settings

CONFIRMED: en-US; short date M/d/yyyy; long time h:mm:ss tt; time zone Eastern
Standard Time. No locale-dependent document content was created.
'@

Add-Text "application/application-identity.md" @'
# Application identity

| Field | Observation | Classification |
|---|---|---|
| Product | Adobe Photoshop CS6 | CONFIRMED |
| Version | 13.0 x64 / ProductVersion CS6 | CONFIRMED |
| Executable | C:\Program Files\Adobe\Adobe Photoshop CS6 (64 Bit)\Photoshop.exe | CONFIRMED |
| Publisher | Adobe Systems, Incorporated | CONFIRMED |
| Window | Adobe Photoshop CS6 / HWND 6884148 | CONFIRMED |
| Package | none observed; traditional executable | STRONG_INFERENCE |
'@
Add-Text "application/process-inventory.md" @'
# Process inventory

Photoshop.exe: PID 27004; parent PID 8084; responding True; working set
221,212,672 bytes; start time 2026-08-01 11:15:12 PM; command line points to the
Adobe Photoshop CS6 64-bit executable. No restart or termination was performed.
'@
Add-Text "application/executable-metadata.md" @'
# Executable metadata

CONFIRMED: file size 62,231,200 bytes; file metadata timestamp 2012-03-15 03:20:52;
FileDescription Adobe Photoshop CS6; ProductName Adobe Photoshop CS6; CompanyName
Adobe Systems, Incorporated; FileVersion 13.0 (13.0 20120315.r.428
2012/03/15:21:00:00); ProductVersion CS6; raw version 13.0.0.0; language English
(United States); copyright Copyright 2012 Adobe Systems Inc.
'@
Add-Text "application/package-identity.md" @'
# Package identity

UNKNOWN / STRONG_INFERENCE: no MSIX or AppX identity was observed or needed. The
target is a traditional installed Win32 executable.
'@
Add-Text "application/window-inventory.md" @'
# Window inventory

| Window | HWND | Status | Notes |
|---|---:|---|---|
| Main Photoshop window | 6884148 | CONFIRMED | Maximized, responding |
| About Photoshop surface | not separately enumerated | CONFIRMED visually | Modal-like surface; no second top-level HWND |

UI Automation exposed title bar, system menu, menu bar, standard window buttons, and
top-level menu items. Canvas, docked panels, toolbox, owner-drawn menus, and About were
only partially exposed.
'@
Add-Text "application/framework-observations.md" @'
# Framework observations

CONFIRMED: classic desktop chrome, standard menu bar, docked panes, and custom-drawn
tool and flyout surfaces. STRONG_INFERENCE: legacy native desktop or owner-drawn
architecture. This is not a toolkit identification.
'@

Add-Text "screens/screen-catalog.csv" @'
screen_id,name,state,status,evidence,notes
000_initial_untouched,Initial blank workspace,untouched,VISUALLY_INSPECTED,evidence/screenshots/windows/000_initial_untouched.jpg,no document
002_final_restored_baseline,Restored blank workspace,restored,CONFIRMED,evidence/screenshots/windows/002_final_restored_baseline.jpg,Rectangular Marquee active
009_file_menu_open,File menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/009_file_menu_open_0.jpg,disabled document commands
013_edit_menu_open,Edit menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/013_edit_menu_open_0.jpg,disabled document commands
017_image_menu_open,Image menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/017_image_menu_open_0.jpg,no document
023_layer_menu_open,Layer menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/023_layer_menu_open_0.jpg,no document
026_type_menu_open,Type menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/026_type_menu_open_0.jpg,no document
029_select_menu_open,Select menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/029_select_menu_open_0.jpg,no document
031_filter_menu_open,Filter menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/031_filter_menu_open_0.jpg,no document
033_view_menu_open,View menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/033_view_menu_open_0.jpg,safe visual inspection
036_window_menu_open,Window menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/036_window_menu_open_0.jpg,dock inventory
040_help_menu_open,Help menu,open,VISUALLY_INSPECTED,evidence/screenshots/windows/040_help_menu_open_0.jpg,safe visual inspection
041_about_dialog,About Photoshop,visual modal,VISUALLY_INSPECTED,evidence/screenshots/windows/041_about_dialog_0.jpg,closed with Escape
100_tool_marquee_flyout,Marquee flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/100_tool_marquee_flyout_0.jpg,4 members
101_tool_move_flyout,Move tool,selected,VISUALLY_INSPECTED,evidence/tools/screenshots/101_tool_move_flyout_0.jpg,no flyout
102_tool_lasso_flyout,Lasso flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/102_tool_lasso_flyout_0.jpg,3 members
103_tool_quick_selection_flyout,Quick Selection flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/103_tool_quick_selection_flyout_0.jpg,2 members
104_tool_crop_flyout,Crop flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/104_tool_crop_flyout_0.jpg,4 members
105_tool_eyedropper_flyout,Eyedropper flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/105_tool_eyedropper_flyout_0.jpg,4 members
106_tool_healing_flyout,Healing flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/106_tool_healing_flyout_0.jpg,5 members
107_tool_clone_stamp_flyout,Clone Stamp flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/107_tool_clone_stamp_flyout_0.jpg,2 members
108_tool_history_brush_flyout,History Brush flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/108_tool_history_brush_flyout_0.jpg,2 members
109_tool_eraser_flyout,Eraser flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/109_tool_eraser_flyout_0.jpg,3 members
110_tool_gradient_flyout,Gradient flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/110_tool_gradient_flyout_0.jpg,2 members
111_tool_blur_flyout,Blur flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/111_tool_blur_flyout_0.jpg,3 members
112_tool_dodge_flyout,Dodge flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/112_tool_dodge_flyout_0.jpg,3 members
113_tool_pen_flyout,Pen flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/113_tool_pen_flyout_0.jpg,5 members
114_tool_type_flyout,Type flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/114_tool_type_flyout_0.jpg,4 members
115_tool_path_selection_flyout,Path Selection flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/115_tool_path_selection_flyout_0.jpg,2 members
116_tool_shape_flyout,Shape flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/116_tool_shape_flyout_0.jpg,6 members
117_tool_hand_flyout,Hand flyout,open,VISUALLY_INSPECTED,evidence/tools/screenshots/117_tool_hand_flyout_0.jpg,2 members
118_tool_zoom_flyout,Zoom tool,selected,VISUALLY_INSPECTED,evidence/tools/screenshots/118_tool_zoom_flyout.jpg,no flyout
'@

Add-Text "windows/top-level-window-catalog.csv" @'
window_id,title,role,hWnd,status,notes
WIN-001,Adobe Photoshop CS6,main application window,6884148,CONFIRMED,maximized and responding
WIN-002,About Photoshop,visual modal surface,not separately enumerated,VISUALLY_INSPECTED,no second top-level window
WIN-003,Photoshop menu and flyout surfaces,owner-drawn popup,not separately enumerated,VISUALLY_INSPECTED,screenshot evidence
'@
Add-Text "windows/dialog-catalog.csv" @'
dialog_id,name,trigger,status,side_effect_policy,evidence
DIALOG-001,About Photoshop,Help > About Photoshop,VISUALLY_INSPECTED,closed with Escape,evidence/screenshots/windows/041_about_dialog_0.jpg
DIALOG-002,Preferences,Edit > Preferences,UNTESTED_EXTERNAL_SIDE_EFFECT,not opened,evidence/screenshots/windows/014_edit_preferences_submenu_0.jpg
DIALOG-003,New Document,File > New,UNTESTED_DESTRUCTIVE,not opened,evidence/screenshots/windows/009_file_menu_open_0.jpg
'@
Add-Text "windows/popup-and-menu-catalog.csv" @'
popup_id,owner,contents,status,evidence
POP-001,File,New Open Save Import Automate Scripts Print Exit,VISUALLY_INSPECTED,evidence/screenshots/windows/009_file_menu_open_0.jpg
POP-002,Edit,Undo Clipboard Fill Transform Preferences,VISUALLY_INSPECTED,evidence/screenshots/windows/013_edit_menu_open_0.jpg
POP-003,Image,Mode Adjustments Size Canvas Rotation Analysis,VISUALLY_INSPECTED,evidence/screenshots/windows/017_image_menu_open_0.jpg
POP-004,Layer,New Duplicate Styles Masks Arrange Merge Flatten,VISUALLY_INSPECTED,evidence/screenshots/windows/023_layer_menu_open_0.jpg
POP-005,Type,Panels Orientation OpenType Rasterize Warp,VISUALLY_INSPECTED,evidence/screenshots/windows/026_type_menu_open_0.jpg
POP-006,Select,selection and layer-selection commands,VISUALLY_INSPECTED,evidence/screenshots/windows/029_select_menu_open_0.jpg
POP-007,Filter,filter families and plug-in entry points,VISUALLY_INSPECTED,evidence/screenshots/windows/031_filter_menu_open_0.jpg
POP-008,View,proof zoom screen extras guides slices,VISUALLY_INSPECTED,evidence/screenshots/windows/033_view_menu_open_0.jpg
POP-009,Window,docks workspaces extensions arrange,VISUALLY_INSPECTED,evidence/screenshots/windows/036_window_menu_open_0.jpg
POP-010,Help,help about system info online resources,VISUALLY_INSPECTED,evidence/screenshots/windows/040_help_menu_open_0.jpg
'@
Add-Text "windows/window-management-behavior.md" @'
# Window management

CONFIRMED: maximized main window, standard minimize/maximize/close buttons, fixed
left toolbox, right dock, bottom tabs, and upper-right workspace selector.
UNTESTED: floating docks, tear-off panels, multi-document tabs, full-screen modes,
secondary windows, monitor migration, and DPI changes.
'@

Add-Text "flows/flow-catalog.csv" @'
flow_id,name,entry,state,status,side_effects,evidence
FLOW-001,Initial shell,current Photoshop,blank workspace,VISUALLY_INSPECTED,none,evidence/screenshots/windows/000_initial_untouched.jpg
FLOW-002,Menu inventory,menu bar,menus and submenus,VISUALLY_INSPECTED,none,evidence/screenshots/windows/009_file_menu_open_0.jpg
FLOW-003,Tool inventory,left toolbox,flyouts,VISUALLY_INSPECTED,tool selection changed options bar,evidence/tools/screenshots/100_tool_marquee_flyout_0.jpg
FLOW-004,About inspection,Help menu,About surface,VISUALLY_INSPECTED,closed with Escape,evidence/screenshots/windows/041_about_dialog_0.jpg
FLOW-005,Restore baseline,left toolbox,blank workspace,CONFIRMED,none,evidence/screenshots/windows/002_final_restored_baseline.jpg
FLOW-006,Create document,File > New,not entered,UNTESTED_DESTRUCTIVE,not attempted,evidence/screenshots/windows/009_file_menu_open_0.jpg
FLOW-007,Edit artwork,canvas,not entered,UNTESTED_DESTRUCTIVE,not attempted,evidence/screenshots/windows/000_initial_untouched.jpg
FLOW-008,File and clipboard,File menu,not entered,UNTESTED_EXTERNAL_SIDE_EFFECT,not attempted,evidence/screenshots/windows/009_file_menu_open_0.jpg
'@
Add-Text "flows/navigation-map.mmd" @'
flowchart TD
    A["Photoshop CS6 blank workspace"] --> B["Menu bar"]
    B --> C["File"]
    B --> D["Edit"]
    B --> E["Image"]
    B --> F["Layer"]
    B --> G["Type"]
    B --> H["Select"]
    B --> I["Filter"]
    B --> J["View"]
    B --> K["Window"]
    B --> L["Help"]
    A --> M["Left toolbox"] --> N["Safe tool flyout inspection"]
    A --> O["Right docked panels"]
    A --> P["Mini Bridge / Timeline tabs"]
    N --> Q["Rectangular Marquee restored"]
'@
Add-Text "flows/state-transition-map.mmd" @'
stateDiagram-v2
    [*] --> BlankWorkspace
    BlankWorkspace --> MenuOpen: open menu
    MenuOpen --> BlankWorkspace: Escape
    BlankWorkspace --> ToolFlyout: right-click grouped tool
    ToolFlyout --> ToolSelected: inspect/select tool
    ToolSelected --> BlankWorkspace: choose Rectangular Marquee
    BlankWorkspace --> AboutSurface: Help > About Photoshop
    AboutSurface --> BlankWorkspace: Escape
    BlankWorkspace --> DocumentState: File > New
    DocumentState --> BlankWorkspace: not exercised
'@
Add-Text "flows/keyboard-shortcut-map.csv" @'
command,shortcut,source,status
New,Ctrl+N,File,CONFIRMED
Open,Ctrl+O,File,CONFIRMED
Close,Ctrl+W,File,disabled without document
Save,Ctrl+S,File,disabled without document
Print,Ctrl+P,File,disabled without document
Exit,Ctrl+Q,File,CONFIRMED
Undo,Ctrl+Z,Edit,disabled without document
Free Transform,Ctrl+T,Edit,disabled without document
Preferences,Ctrl+K,Edit,CONFIRMED
Keyboard Shortcuts,Alt+Shift+Ctrl+K,Edit,CONFIRMED
Zoom In,Ctrl++,View,CONFIRMED
Zoom Out,Ctrl+-,View,CONFIRMED
Fit on Screen,Ctrl+0,View,CONFIRMED
Actual Pixels,Ctrl+1,View,CONFIRMED
Rectangular Marquee,M,toolbox,CONFIRMED
Move,V,toolbox,CONFIRMED
Lasso,L,toolbox,CONFIRMED
Quick Selection,W,toolbox,CONFIRMED
Crop,C,toolbox,CONFIRMED
Eyedropper,I,toolbox,CONFIRMED
Healing,J,toolbox,CONFIRMED
Clone Stamp,S,toolbox,CONFIRMED
History Brush,Y,toolbox,CONFIRMED
Eraser,E,toolbox,CONFIRMED
Gradient,G,toolbox,CONFIRMED
Blur,R,toolbox,CONFIRMED
Dodge,O,toolbox,CONFIRMED
Pen,P,toolbox,CONFIRMED
Type,T,toolbox,CONFIRMED
Path Selection,A,toolbox,CONFIRMED
Shape,U,toolbox,CONFIRMED
Hand,H,toolbox,CONFIRMED
Rotate View,R,toolbox,CONFIRMED
Zoom,Z,toolbox,CONFIRMED
'@

$toolRows = [Collections.Generic.List[string]]::new()
$toolRows.Add("tool_id,family,name,shortcut,status,prerequisite,output,what_it_is_and_does,source,evidence")
$families = @(
    @("Marquee","M",@("Rectangular Marquee Tool","Elliptical Marquee Tool","Single Row Marquee Tool","Single Column Marquee Tool"),"100_tool_marquee_flyout"),
    @("Move","V",@("Move Tool"),"101_tool_move_flyout"),
    @("Lasso","L",@("Lasso Tool","Polygonal Lasso Tool","Magnetic Lasso Tool"),"102_tool_lasso_flyout"),
    @("Selection","W",@("Quick Selection Tool","Magic Wand Tool"),"103_tool_quick_selection_flyout"),
    @("Crop","C",@("Crop Tool","Perspective Crop Tool","Slice Tool","Slice Select Tool"),"104_tool_crop_flyout"),
    @("Sampling","I",@("Eyedropper Tool","Color Sampler Tool","Ruler Tool","Note Tool"),"105_tool_eyedropper_flyout"),
    @("Healing","J",@("Spot Healing Brush Tool","Healing Brush Tool","Patch Tool","Content-Aware Move Tool","Red Eye Tool"),"106_tool_healing_flyout"),
    @("Clone","S",@("Clone Stamp Tool","Pattern Stamp Tool"),"107_tool_clone_stamp_flyout"),
    @("History","Y",@("History Brush Tool","Art History Brush Tool"),"108_tool_history_brush_flyout"),
    @("Eraser","E",@("Eraser Tool","Background Eraser Tool","Magic Eraser Tool"),"109_tool_eraser_flyout"),
    @("Fill","G",@("Gradient Tool","Paint Bucket Tool"),"110_tool_gradient_flyout"),
    @("Blur","R",@("Blur Tool","Sharpen Tool","Smudge Tool"),"111_tool_blur_flyout"),
    @("Tone","O",@("Dodge Tool","Burn Tool","Sponge Tool"),"112_tool_dodge_flyout"),
    @("Pen","P",@("Pen Tool","Freeform Pen Tool","Add Anchor Point Tool","Delete Anchor Point Tool","Convert Point Tool"),"113_tool_pen_flyout"),
    @("Type","T",@("Horizontal Type Tool","Vertical Type Tool","Horizontal Type Mask Tool","Vertical Type Mask Tool"),"114_tool_type_flyout"),
    @("Path Selection","A",@("Path Selection Tool","Direct Selection Tool"),"115_tool_path_selection_flyout"),
    @("Shape","U",@("Rectangle Tool","Rounded Rectangle Tool","Ellipse Tool","Polygon Tool","Line Tool","Custom Shape Tool"),"116_tool_shape_flyout"),
    @("Navigation","H/R/Z",@("Hand Tool","Rotate View Tool","Zoom Tool"),"117_tool_hand_flyout")
)
$toolDescriptions = @{
    "Rectangular Marquee Tool" = "Makes rectangular pixel selections."
    "Elliptical Marquee Tool" = "Makes elliptical or circular pixel selections."
    "Single Row Marquee Tool" = "Makes a one-pixel-high selection across the image."
    "Single Column Marquee Tool" = "Makes a one-pixel-wide selection down the image."
    "Move Tool" = "Moves a selection, layer, object, or guide."
    "Lasso Tool" = "Draws a freehand selection boundary."
    "Polygonal Lasso Tool" = "Builds a selection from straight-edged segments."
    "Magnetic Lasso Tool" = "Builds a selection that snaps toward detected image edges."
    "Quick Selection Tool" = "Paints a selection while detecting nearby color and texture edges."
    "Magic Wand Tool" = "Selects similarly colored pixels based on tolerance and contiguity."
    "Crop Tool" = "Trims the canvas or image to a chosen crop boundary."
    "Perspective Crop Tool" = "Crops an image while correcting a perspective-shaped boundary."
    "Slice Tool" = "Divides an image into rectangular slices for web-oriented output."
    "Slice Select Tool" = "Selects and edits existing image slices."
    "Eyedropper Tool" = "Samples a color from the image into the foreground color."
    "Color Sampler Tool" = "Places sample points that report color values from the image."
    "Ruler Tool" = "Measures distance, position, and angle in the image."
    "Note Tool" = "Attaches an annotation note to an image."
    "Spot Healing Brush Tool" = "Removes small blemishes or objects by blending surrounding pixels."
    "Healing Brush Tool" = "Repairs imperfections using sampled pixels while blending texture and tone."
    "Patch Tool" = "Repairs a selected area using pixels from a sampled source or pattern."
    "Content-Aware Move Tool" = "Moves a selected object and fills its former area using surrounding content."
    "Red Eye Tool" = "Removes the red reflection caused by a camera flash."
    "Clone Stamp Tool" = "Paints a copy of pixels from a sampled source."
    "Pattern Stamp Tool" = "Paints using a selected repeating pattern."
    "History Brush Tool" = "Paints pixels from a chosen history state or snapshot."
    "Art History Brush Tool" = "Paints stylized strokes based on a chosen history state or snapshot."
    "Eraser Tool" = "Erases pixels or restores them toward a saved state depending on its mode."
    "Background Eraser Tool" = "Erases sampled background colors toward transparency as it is dragged."
    "Magic Eraser Tool" = "Erases similarly colored contiguous pixels to transparency with a click."
    "Gradient Tool" = "Fills an area with a gradual blend between colors or presets."
    "Paint Bucket Tool" = "Fills a contiguous similarly colored area with a color or pattern."
    "Blur Tool" = "Softens hard edges and reduces local detail."
    "Sharpen Tool" = "Increases local edge contrast to make soft details appear sharper."
    "Smudge Tool" = "Smears and blends pixels as though pushing wet paint."
    "Dodge Tool" = "Lightens selected image areas."
    "Burn Tool" = "Darkens selected image areas."
    "Sponge Tool" = "Raises or lowers color saturation in an area."
    "Pen Tool" = "Draws precise paths with straight and curved segments."
    "Freeform Pen Tool" = "Draws paths freehand rather than point by point."
    "Add Anchor Point Tool" = "Adds an anchor point to an existing path."
    "Delete Anchor Point Tool" = "Removes an anchor point from an existing path."
    "Convert Point Tool" = "Converts an anchor between corner and smooth curve behavior."
    "Horizontal Type Tool" = "Creates editable horizontal point or paragraph text."
    "Vertical Type Tool" = "Creates editable vertical point or paragraph text."
    "Horizontal Type Mask Tool" = "Creates a selection shaped by horizontal text."
    "Vertical Type Mask Tool" = "Creates a selection shaped by vertical text."
    "Path Selection Tool" = "Selects and moves an entire path or shape."
    "Direct Selection Tool" = "Selects and edits individual path points or segments."
    "Rectangle Tool" = "Draws rectangular or square shapes and paths."
    "Rounded Rectangle Tool" = "Draws rectangles with rounded corners."
    "Ellipse Tool" = "Draws circular or elliptical shapes and paths."
    "Polygon Tool" = "Draws polygonal shapes with a configurable number of sides."
    "Line Tool" = "Draws straight line shapes or paths."
    "Custom Shape Tool" = "Draws a selected predefined or custom vector shape."
    "Hand Tool" = "Pans the image within its document window."
    "Rotate View Tool" = "Rotates the canvas view without changing the image pixels."
    "Zoom Tool" = "Magnifies or reduces the document view."
    "Quick Mask Mode" = "Edits a temporary selection mask as an overlay."
    "Screen Mode" = "Switches the Photoshop workspace display mode."
}
$sourceMap = @{
    "Marquee" = "Adobe selection tools overview; Adobe CS6 Photoshop Reference"
    "Move" = "Adobe selection tools overview; Adobe CS6 Photoshop Reference"
    "Lasso" = "Adobe selection tools overview; Adobe CS6 Photoshop Reference"
    "Selection" = "Adobe selection tools overview; Adobe CS6 Photoshop Reference"
    "Crop" = "Adobe CS6 Photoshop Reference; Adobe crop documentation"
    "Sampling" = "Adobe navigation and measuring tools overview; Adobe painting tools overview"
    "Healing" = "Adobe retouch tools overview"
    "Clone" = "Adobe painting tools overview; Adobe Clone Stamp documentation"
    "History" = "Adobe painting tools overview; Adobe CS6 Photoshop Reference"
    "Eraser" = "Adobe retouch tools overview"
    "Fill" = "Adobe painting tools overview"
    "Blur" = "Adobe retouch tools overview"
    "Tone" = "Adobe retouch tools overview"
    "Pen" = "Adobe drawing tools overview; Adobe Pen tool settings"
    "Type" = "Adobe add text documentation; Adobe CS6 Photoshop Reference"
    "Path Selection" = "Adobe CS6 Photoshop Reference; Adobe drawing tools overview"
    "Shape" = "Adobe drawing tools overview"
    "Navigation" = "Adobe navigation and measuring tools overview"
    "Mode" = "Adobe CS6 Photoshop Reference"
}
$shortcutByTool = @{
    "Single Row Marquee Tool" = ""
    "Single Column Marquee Tool" = ""
    "Hand Tool" = "H"
    "Rotate View Tool" = "R"
    "Zoom Tool" = "Z"
}
$n = 0
foreach ($family in $families) {
    foreach ($name in $family[2]) {
        $n++
        $shortcut = if ($shortcutByTool.ContainsKey($name)) { $shortcutByTool[$name] } else { $family[1] }
        $output = if ($family[0] -in @("Marquee","Lasso","Selection")) {"selection"} elseif ($family[0] -eq "Move") {"layers or selections"} elseif ($family[0] -eq "Type") {"text or selection"} elseif ($family[0] -eq "Pen") {"path"} elseif ($family[0] -eq "Shape") {"shape layer or path"} elseif ($family[0] -eq "Navigation") {"viewport"} else {"document pixels"}
        $description = $toolDescriptions[$name]
        $source = $sourceMap[$family[0]]
        $toolRows.Add(("TOOL-{0:D3},{1},{2},{3},VISUALLY_INSPECTED,open document,{4},{5},{6},evidence/tools/screenshots/{7}_0.jpg" -f $n,$family[0],$name,$shortcut,$output,$description,$source,$family[3]))
    }
}
$n++
$toolRows.Add(("TOOL-{0:D3},Mode,Quick Mask Mode,,VISUALLY_INSPECTED,document state,mask overlay,{1},Adobe CS6 Photoshop Reference,evidence/screenshots/windows/002_final_restored_baseline.jpg" -f $n,$toolDescriptions["Quick Mask Mode"]))
$n++
$toolRows.Add(("TOOL-{0:D3},Mode,Screen Mode,,VISUALLY_INSPECTED,application state,window mode,{1},Adobe CS6 Photoshop Reference,evidence/screenshots/windows/034_view_screen_mode_submenu_0.jpg" -f $n,$toolDescriptions["Screen Mode"]))
Add-Text "tools/tool-catalog.csv" ($toolRows -join [Environment]::NewLine)

$detailLines = [Collections.Generic.List[string]]::new()
$detailLines.Add("# Tool details")
$detailLines.Add("")
$detailLines.Add("These descriptions explain the intended Photoshop function of every visible tool cataloged in the live audit. The descriptions are research-backed reference behavior; the live instance had no document, so canvas behavior remains UNTESTED.")
$detailLines.Add("")
foreach ($family in $families) {
    $detailLines.Add(("## {0}" -f $family[0]))
    $detailLines.Add("")
    foreach ($name in $family[2]) {
        $detailShortcut = if ($shortcutByTool.ContainsKey($name)) { $shortcutByTool[$name] } else { $family[1] }
        $detailLines.Add(("- **{0}** ({1}): {2}" -f $name,$detailShortcut,$toolDescriptions[$name]))
    }
    $detailLines.Add("")
}
$detailLines.Add("## Mode controls")
$detailLines.Add("")
$detailLines.Add(("- **Quick Mask Mode**: {0}" -f $toolDescriptions["Quick Mask Mode"]))
$detailLines.Add(("- **Screen Mode**: {0}" -f $toolDescriptions["Screen Mode"]))
Add-Text "tools/tool-details.md" ($detailLines -join [Environment]::NewLine)

Add-Text "tools/tool-research-sources.md" @'
# Tool research sources

The live Photoshop CS6 screenshots establish which tools were present and how they
were grouped. Adobe documentation was used only to describe intended tool purpose.
Current Adobe help can include tools added after CS6; those newer tools were not added
to this audit. The CS6 reference is the version-specific authority where behavior or
shortcut details differ.

- Adobe Photoshop CS6 Reference: https://helpx.adobe.com/pdf/cs6/photoshop_reference.pdf
- Adobe selection tools overview: https://helpx.adobe.com/photoshop/desktop/make-selections/get-started-selections/selection-tools-overview.html
- Adobe painting tools overview: https://helpx.adobe.com/photoshop/desktop/apply-painting-techniques/fill-objects-selections-layers/painting-tools-overview.html
- Adobe retouch tools overview: https://helpx.adobe.com/photoshop/desktop/repair-retouch/remove-objects-fill-space/retouch-tools-overview.html
- Adobe drawing tools overview: https://helpx.adobe.com/photoshop/desktop/draw-shapes-paths/create-shapes/drawing-tools-overview.html
- Adobe Pen tool settings: https://helpx.adobe.com/photoshop/desktop/draw-shapes-paths/draw-lines-curves/overview-of-pen-tool-settings.html
- Adobe navigation and measuring tools: https://helpx.adobe.com/photoshop/desktop/use-grids-measurement-guides/alignment-grids-guides/navigation-and-measuring-tools-overview.html
- Adobe text tool guidance: https://helpx.adobe.com/photoshop/desktop/text-typography/get-started-with-text/add-text.html
'@

Add-Text "tools/tools-menu-overview.md" @'
# Tools overview

Photoshop has no separate Tools menu. The equivalent visible surface is the left
two-column toolbox. Grouped cells open dark anchored flyouts showing glyph, exact
member label, and shared shortcut. The live audit cataloged every visible member.
Canvas behavior is untested because no document was open. See tool-catalog.csv for
machine-readable rows with purpose and research source, and tool-details.md for the
human-readable explanation of every tool.
'@
Add-Text "tools/tool-state-coverage.csv" @'
family,members,inspection,status,blocked_reason
Marquee,4,flyout,VISUALLY_INSPECTED,no document
Move,1,options bar,VISUALLY_INSPECTED,no document
Lasso,3,flyout,VISUALLY_INSPECTED,no document
Selection,2,flyout,VISUALLY_INSPECTED,no document
Crop,4,flyout,VISUALLY_INSPECTED,no document
Sampling,4,flyout,VISUALLY_INSPECTED,no document
Healing,5,flyout,VISUALLY_INSPECTED,no document
Clone,2,flyout,VISUALLY_INSPECTED,no document
History,2,flyout,VISUALLY_INSPECTED,no document
Eraser,3,flyout,VISUALLY_INSPECTED,no document
Fill,2,flyout,VISUALLY_INSPECTED,no document
Blur,3,flyout,VISUALLY_INSPECTED,no document
Tone,3,flyout,VISUALLY_INSPECTED,no document
Pen,5,flyout,VISUALLY_INSPECTED,no document
Type,4,flyout,VISUALLY_INSPECTED,no document
Path Selection,2,flyout,VISUALLY_INSPECTED,no document
Shape,6,flyout,VISUALLY_INSPECTED,no document
Navigation,3,flyout/options,VISUALLY_INSPECTED,no document
'@
Add-Text "tools/tool-prerequisite-matrix.csv" @'
family,requires_document,requires_layer,requires_path,requires_selection,observed
Marquee,yes,no,no,no,flyout only
Move,yes,usually,no,no,options bar only
Lasso,yes,no,no,no,flyout only
Selection,yes,usually,no,no,flyout only
Crop,yes,no,no,no,flyout only
Sampling,yes,no,no,no,flyout only
Healing,yes,usually,no,no,flyout only
Clone,yes,usually,no,no,flyout only
History,yes,usually,optional,no,flyout only
Eraser,yes,usually,no,no,flyout only
Fill,yes,usually,no,no,flyout only
Blur,yes,usually,no,no,flyout only
Tone,yes,usually,no,no,flyout only
Pen,yes,no,optional,no,options bar only
Type,yes,no,no,no,options bar only
Path Selection,yes,no,yes,no,options bar only
Shape,yes,no,optional,no,options bar only
Navigation,yes,no,no,no,options bar only
'@
Add-Text "tools/tool-shortcuts.csv" (Get-Content (Join-Path $Root "flows/keyboard-shortcut-map.csv") -Raw)
Add-Text "tools/tool-output-catalog.csv" @'
output_type,producer_families,status,notes
Pixel selection,Marquee/Lasso/Selection/Type Mask,UNTESTED,requires document
Path,Pen/Path Selection/Shape,UNTESTED,requires document
Text layer,Type,UNTESTED,requires document and font handling
Shape layer,Shape,UNTESTED,requires document
Pixel edits,Healing/Clone/Eraser/Blur/Tone/Fill,UNTESTED_DESTRUCTIVE,not exercised
Viewport,Hand/Rotate View/Zoom,VISUALLY_INSPECTED,no document viewport
Mask overlay,Quick Mask Mode,UNTESTED,no document
'@
Add-Text "tools/tool-safety-classification.csv" @'
family,classification,status,reason
Marquee/Lasso/Selection,read-only visual,VISUALLY_INSPECTED,only flyouts opened
Navigation,read-only visual,VISUALLY_INSPECTED,no viewport
Sampling/Measurement,read-only visual,VISUALLY_INSPECTED,no canvas
Pen/Type/Shape,document mutation possible,UNTESTED_DESTRUCTIVE,no document
Healing/Clone/Eraser/Blur/Tone/Fill,pixel mutation possible,UNTESTED_DESTRUCTIVE,no document
Quick Mask/Screen Mode,mode change,UNTESTED_EXTERNAL_SIDE_EFFECT,no toggle committed
'@
Add-Text "tools/tool-reconstruction-requirements.md" @'
# Tool reconstruction requirements

Build a fixed two-column toolbox with exact labels, glyphs, row groups, current-tool
highlight, and anchored dark flyouts. Flyouts list the exact member label and shared
shortcut. Tool selection updates the options bar but must not mutate a document until
a canvas gesture. Keep tool command state separate from document mutation, and expose
all custom surfaces to accessibility APIs.
'@
foreach ($family in $families) {
    $spec = [ordered]@{
        toolFamily = $family[0]
        classification = "CONFIRMED"
        status = "VISUALLY_INSPECTED"
        members = $family[2]
        shortcut = $family[1]
        canvasBehavior = "UNTESTED"
        prerequisite = "Open document"
        evidence = "evidence/tools/screenshots/" + $family[3] + "_0.jpg"
    }
    $safe = $family[0] -replace "[^A-Za-z0-9]","_"
    Add-Text ("tools/specifications/TOOL_{0}.json" -f $safe) ($spec | ConvertTo-Json -Depth 5)
}

Add-Text "design/design-system.md" @'
# Design system

CONFIRMED visually: dark neutral workspace, compact menu typography, narrow
two-column toolbox, stacked right dock, bottom tab strip, subtle separators, and
reduced-contrast disabled states. STRONG_INFERENCE: dense professional desktop
hierarchy with persistent chrome and context-specific options.
'@
Add-Text "design/design-tokens.json" @'
{"classification":"STRONG_INFERENCE","workspace":"dark neutral gray","toolbar":"medium dark gray","dock":"medium dark gray","states":["normal","selected","disabled","hover/flyout"],"note":"Visual estimates; not sampled source values."}
'@
Add-Text "design/component-catalog.md" @'
# Component catalog

Window chrome; menu bar; options bar; workspace selector; two-column toolbox; tool
flyout; right dock and panel tabs; Layers/Channels/Paths panel; Mini Bridge/Timeline
tabs; color swatches; Quick Mask and Screen Mode controls; About surface; canvas.
'@
Add-Text "design/typography.md" @'
# Typography

CONFIRMED visually: compact sans-serif UI text in menus, flyouts, tabs, and options
controls. Exact family and rendering settings remain UNKNOWN.
'@
Add-Text "design/color-inventory.csv" @'
role,observation,classification
workspace,dark neutral gray,CONFIRMED_VISUAL
menu text,light gray on dark gray,CONFIRMED_VISUAL
disabled controls,reduced contrast gray,CONFIRMED_VISUAL
selected tool,blue-gray highlight,CONFIRMED_VISUAL
foreground/background,black and white swatches,CONFIRMED_VISUAL
'@
Add-Text "design/asset-inventory.csv" @'
asset,source,status,note
toolbar glyphs,live Photoshop screenshot,REFERENCE_ONLY,recreate original project assets
Photoshop mark,live application chrome,REFERENCE_ONLY,do not ship Adobe artwork
panel glyphs,live screenshot,REFERENCE_ONLY,design original equivalents
'@
Add-Text "design/layout-measurements.csv" @'
region,observed_value,classification
capture region,1728x929,CONFIRMED
capture origin,57x30,CONFIRMED
primary display,1920x1080,CONFIRMED
secondary display,1920x1080,CONFIRMED
toolbox,two compact columns,CONFIRMED_VISUAL
right dock,stacked panels,CONFIRMED_VISUAL
'@

Add-Text "behavior/behavior-specification.md" @'
# Behavior specification

The empty state is stable shell chrome, not an error. Menus remain available while
document-dependent commands are disabled. Escape closes menus and flyouts. Tool
selection immediately changes the options bar. The right dock remains present with
empty or disabled controls. Final state restored to Rectangular Marquee.
'@
Add-Text "behavior/validation-rules.csv" @'
rule_id,area,rule,status
VAL-001,Document gating,document commands disable without document,CONFIRMED
VAL-002,Tools,selection alone must not mutate artwork,STRONG_INFERENCE
VAL-003,Menus,Escape closes open menu or flyout,CONFIRMED
VAL-004,Options bar,tool selection changes options context,CONFIRMED
VAL-005,Persistence,settings and workspace changes persist,UNKNOWN
VAL-006,Files,file actions require side-effect review,UNTESTED_EXTERNAL_SIDE_EFFECT
'@
Add-Text "behavior/keyboard-and-focus.md" @'
# Keyboard and focus

Menu and tool shortcuts were read from live labels. Escape closed popups and a
toolbar click restored the baseline. Full traversal, focus rings, accelerator
precedence, and canvas focus remain UNTESTED.
'@
Add-Text "behavior/mouse-and-pointer.md" @'
# Mouse and pointer

Safe pointer use was limited to the menu bar and verified toolbar cells. Right-click
on a grouped cell opens an anchored flyout. No canvas gesture occurred.
'@
Add-Text "behavior/menus-tooltips-and-flyouts.md" @'
# Menus, tooltips, and flyouts

Menus are dark, compact, hierarchical, and retain disabled entries. Tool flyouts
are dark owner-drawn panels anchored to the selected cell and show glyph, name, and
shortcut. UI Automation did not reliably expose their contents.
'@
Add-Text "behavior/errors-loading-and-empty-states.md" @'
# Errors and empty states

Observed empty state: empty canvas region, persistent shell, right panels present,
and document-dependent menu entries disabled. No loading, crash, plugin, missing-font,
or file-error dialog was invoked.
'@
Add-Text "behavior/persistence-and-lifecycle.md" @'
# Persistence and lifecycle

The process was already running and responding. No restart, close, update, sign-out,
workspace reset, preference change, or license operation was performed.
'@
Add-Text "behavior/file-clipboard-import-export-print.md" @'
# File and clipboard

File menu entry points and shortcuts were cataloged. Open, save, import, export,
print, Bridge, clipboard, and external-file flows were not entered.
'@

Add-Text "data/inferred-data-model.md" @'
# Inferred data model

Entities implied by the shell: ApplicationSession, Workspace, Document, CanvasViewport,
Layer, Channel, Path, Selection, ToolState, Panel, Command, Preset, HistoryState, and
ExternalFile. Only session, workspace, tool state, panel, command, and empty-document
gating were observable.
'@
Add-Text "data/entity-field-matrix.csv" @'
entity,observed_fields,confidence
ApplicationSession,PID and HWND,CONFIRMED
Workspace,Essentials and panel arrangement,CONFIRMED
Document,absence/no active document,CONFIRMED
ToolState,active tool/options/group,CONFIRMED
Panel,Color/Swatches/Adjustments/Styles/Layers/Channels/Paths,CONFIRMED
Layer,unknown,UNKNOWN
Channel,unknown,UNKNOWN
Path,unknown,UNKNOWN
Selection,commands only,STRONG_INFERENCE
'@
Add-Text "data/grid-and-list-behavior.csv" @'
surface,behavior,status
menus,compact hierarchical list with disabled entries,VISUALLY_INSPECTED
tool flyouts,anchored list with glyph/name/shortcut,VISUALLY_INSPECTED
panel tabs,stacked tabbed dock,VISUALLY_INSPECTED
layers list,empty/disabled without document,VISUALLY_INSPECTED
'@

Add-Text "accessibility/accessibility-audit.md" @'
# Accessibility audit

CONFIRMED: title bar, system menu, menu bar, standard window buttons, and top-level
menu item names appeared in UI Automation. Custom toolbox, flyouts, panel controls,
canvas semantics, and About were partial or absent. Reconstruction must expose
semantic names, roles, shortcuts, checked/disabled state, relationships, and
keyboard traversal for every visible surface.
'@
Add-Text "accessibility/accessibility-element-catalog.csv" @'
element,role,name,automation_status,notes
Main window,Window,Adobe Photoshop CS6,EXPOSED,HWND 6884148
Menu bar,MenuBar,menu bar,EXPOSED,top-level container
Menu items,MenuItem,File through Help,EXPOSED,labels read
Window buttons,Button,Minimize Maximize Close,EXPOSED,standard chrome
Toolbox,Pane,partial,PARTIAL,custom drawn
Tool flyout,Menu,partial,PARTIAL,screenshot authoritative
Right dock,Pane,partial,PARTIAL,custom panels
About,Dialog,unknown,UNKNOWN,visual surface only
'@
Add-Text "accessibility/keyboard-coverage.csv" @'
surface,coverage,status
main menu,menu shortcuts,VISUALLY_INSPECTED
toolbox,tool shortcuts,VISUALLY_INSPECTED
flyouts,Escape close,CONFIRMED
About,Escape close,CONFIRMED
panel traversal,full keyboard path,UNTESTED
canvas interaction,keyboard path,UNTESTED
'@

Add-Text "performance/performance-observations.md" @'
# Performance observations

The safe inspection completed without a visible Photoshop hang or crash. No reliable
render or command latency benchmark was collected; automation overhead is included
in observation calls.
'@
Add-Text "performance/timing-results.csv" @'
operation,result,status,notes
initial observation,completed,QUALITATIVE,automation overhead included
menu inspection,completed,QUALITATIVE,no app latency measurement
tool inspection,completed,QUALITATIVE,no app latency measurement
document creation,not run,UNTESTED_DESTRUCTIVE,disposable test state needed
'@

Add-Text "testing/interaction-test-matrix.csv" @'
test_id,area,case,status,evidence
TEST-001,Shell,blank workspace,VISUALLY_INSPECTED,evidence/screenshots/windows/000_initial_untouched.jpg
TEST-002,Menus,top-level menus and safe submenus,VISUALLY_INSPECTED,evidence/screenshots/windows/
TEST-003,Tools,every visible flyout,VISUALLY_INSPECTED,evidence/tools/screenshots/
TEST-004,Recovery,close popup and restore baseline,CONFIRMED,evidence/screenshots/windows/002_final_restored_baseline.jpg
TEST-005,Documents,create scratch document,UNTESTED_DESTRUCTIVE,not run
TEST-006,Editing,reversible pixel edit,UNTESTED_DESTRUCTIVE,not run
TEST-007,Files,open save import export,UNTESTED_EXTERNAL_SIDE_EFFECT,not run
TEST-008,Accessibility,full keyboard traversal,UNTESTED,not run
'@
Add-Text "testing/state-coverage-matrix.csv" @'
state,observed,status
blank workspace,yes,CONFIRMED
menu open,yes,VISUALLY_INSPECTED
submenu open,yes,VISUALLY_INSPECTED
tool flyout open,yes,VISUALLY_INSPECTED
About surface,yes,VISUALLY_INSPECTED
document with pixels,no,BLOCKED_BY_PREREQUISITE
text editing,no,BLOCKED_BY_PREREQUISITE
layer stack,no,BLOCKED_BY_PREREQUISITE
file dialog,no,UNTESTED_EXTERNAL_SIDE_EFFECT
'@
Add-Text "testing/coverage-report.md" @'
# Coverage report

Complete for the authorized blank-state visual inventory: shell, visible menus,
visible safe submenus, visible toolbox groups, and baseline restoration. Incomplete
for document behavior, file behavior, editing, persistence, and full accessibility.
'@
Add-Text "testing/untested-and-blocked-cases.md" @'
# Untested and blocked cases

Canvas gestures, pixel tools, layers, channels, paths, text, shapes, filters, save,
import, export, print, Bridge, clipboard, preferences, workspace persistence, license,
performance timing, DPI migration, multi-monitor behavior, and full keyboard traversal
were not established in this blank-state audit.
'@

Add-Text "planning/reconstruction-specification.md" @'
# Reconstruction specification

1. Build the application shell: native window, dark workspace, menu bar, options bar,
   two-column toolbox, right dock, bottom tabs, and workspace selector.
2. Model the blank state explicitly: persistent shell plus disabled document commands.
3. Implement exact tool groups, flyouts, shortcuts, current-tool highlight, and
   context-specific options bar.
4. Add disposable document, canvas, layer/channel/path, selection, text, shape,
   history, and undo models.
5. Add command registry with prerequisites and side-effect classifications.
6. Add dock layout, tabs, resize, visibility, reset, accessibility, and visual tests.

Fidelity gates: restored blank-shell screenshot; exact visible labels and shortcuts;
every visible tool reachable by keyboard; correct disabled states; original assets only.
'@
Add-Text "planning/implementation-backlog.md" @'
# Implementation backlog (planning only)

Shell geometry; command registry; options-bar registry; tool flyouts; shortcut
routing; blank document; canvas/layers/selections/paths/text/shapes; dockable panels;
workspace persistence; accessibility semantics; visual regression; safe file and
clipboard adapters.
'@
Add-Text "planning/recommended-architecture.md" @'
# Recommended architecture

Use a state-driven desktop shell with separate services for commands, document model,
viewport, tools, panels/workspace, persistence, and accessibility. Keep menus, flyouts,
options bar, dock, and canvas as thin state subscribers. Put file dialogs, clipboard,
print, plugins, and external side effects behind explicit adapters. Choose the final
framework only after validating native menus, DPI, owner-drawn flyouts, accessibility,
and performance.
'@
Add-Text "planning/open-questions.md" @'
# Open questions

Exact UI framework and DPI mode; enablement by document/layer state; docking and
workspace persistence; complete tool option schemas and cursors; file/plugin scope;
and original asset strategy remain open.
'@
Add-Text "planning/legal-and-asset-considerations.md" @'
# Legal and asset considerations

Screenshots remain local audit evidence. Do not ship Adobe logos, icons, proprietary
artwork, or extracted Photoshop resources. Recreate glyphs, colors, and layout with
original assets and document compatibility and trademark decisions.
'@

$screenIds = @("000_initial_untouched","002_final_restored_baseline","009_file_menu_open","013_edit_menu_open","017_image_menu_open","023_layer_menu_open","026_type_menu_open","029_select_menu_open","031_filter_menu_open","033_view_menu_open","036_window_menu_open","040_help_menu_open","041_about_dialog","100_tool_marquee_flyout","102_tool_lasso_flyout","104_tool_crop_flyout","106_tool_healing_flyout","108_tool_history_brush_flyout","110_tool_gradient_flyout","111_tool_blur_flyout","112_tool_dodge_flyout","113_tool_pen_flyout","114_tool_type_flyout","115_tool_path_selection_flyout","116_tool_shape_flyout","117_tool_hand_flyout","118_tool_zoom_flyout")
foreach ($id in $screenIds) {
    $kind = if ($id -like "1??_tool_*") {"tools"} else {"windows"}
    $evidence = if ($id -eq "118_tool_zoom_flyout") {"evidence/tools/screenshots/118_tool_zoom_flyout.jpg"} else {"evidence/$kind/screenshots/" + $id + "_0.jpg"}
    $spec = [ordered]@{screenId=$id;classification="CONFIRMED";status="VISUALLY_INSPECTED";evidence=$evidence;documentState="no document open";uiAutomation="partial; screenshot authoritative for custom surfaces";sideEffects="none from recorded inspection"}
    Add-Text ("screens/screen-specs/" + $id + ".json") ($spec | ConvertTo-Json -Depth 5)
}
Write-Output "Generated Photoshop audit package under $Root"
