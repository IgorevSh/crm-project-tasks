import { Stack, Text, TextInput } from '@mantine/core'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useState } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

const MOSCOW: [number, number] = [55.751244, 37.618423]

type Props = {
  address: string
  lat: number | null
  lng: number | null
  onChange: (next: {
    address: string
    lat: number | null
    lng: number | null
  }) => void
  readOnly?: boolean
}

function MapClick({
  disabled,
  onPick,
}: {
  disabled?: boolean
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      if (disabled) return
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 15))
  }, [lat, lng, map])
  return null
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('accept-language', 'ru')
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const data = (await res.json()) as { display_name?: string }
  return data.display_name?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function MapAddressPicker({
  address,
  lat,
  lng,
  onChange,
  readOnly,
}: Props) {
  const [busy, setBusy] = useState(false)
  const hasPoint = lat != null && lng != null
  const center: [number, number] = hasPoint ? [lat, lng] : MOSCOW

  const pick = async (nextLat: number, nextLng: number) => {
    if (readOnly) return
    setBusy(true)
    try {
      const nextAddress = await reverseGeocode(nextLat, nextLng)
      onChange({ address: nextAddress, lat: nextLat, lng: nextLng })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="xs">
      <TextInput
        label="Адрес"
        value={address}
        readOnly={readOnly}
        onChange={(e) =>
          onChange({
            address: e.currentTarget.value,
            lat,
            lng,
          })
        }
      />
      {!readOnly && (
        <Text size="xs" c="dimmed">
          Кликните по карте, чтобы поставить точку
          {busy ? '…' : ''}
        </Text>
      )}
      <div
        style={{
          height: 260,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #dee2e6',
          position: 'relative',
          zIndex: 0,
          isolation: 'isolate',
        }}
      >
        <MapContainer
          center={center}
          zoom={hasPoint ? 15 : 11}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClick disabled={readOnly} onPick={(a, b) => void pick(a, b)} />
          {hasPoint && (
            <>
              <Marker position={[lat, lng]} />
              <Recenter lat={lat} lng={lng} />
            </>
          )}
        </MapContainer>
      </div>
    </Stack>
  )
}
