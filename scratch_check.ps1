1..4 | ForEach-Object {
  $b = [System.IO.File]::ReadAllBytes("public/assets/carousel/desktop/$_.webp")
  $w = 1 + [BitConverter]::ToUInt32($b, 24) -band 0x00FFFFFF
  $h = 1 + [BitConverter]::ToUInt32($b, 27) -band 0x00FFFFFF
  $bm = [System.IO.File]::ReadAllBytes("public/assets/carousel/mobile/$_.webp")
  $wm = 1 + [BitConverter]::ToUInt32($bm, 24) -band 0x00FFFFFF
  $hm = 1 + [BitConverter]::ToUInt32($bm, 27) -band 0x00FFFFFF
  Write-Host "Slide $_ Desktop: $w x $h (ratio: $($w/$h)) | Mobile: $wm x $hm (ratio: $($wm/$hm))"
}
