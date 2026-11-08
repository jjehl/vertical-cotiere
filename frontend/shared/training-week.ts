import type { TrainingSlot } from './types.ts'

export const trainingDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const minutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

export function trainingWeek(sessions: TrainingSlot[]) {
  const start = sessions.length ? Math.floor(Math.min(...sessions.map(slot => minutes(slot.start))) / 60) * 60 : 9 * 60
  const end = sessions.length ? Math.ceil(Math.max(...sessions.map(slot => minutes(slot.end))) / 60) * 60 : 23 * 60
  const days = trainingDays.slice(0, sessions.some(slot => slot.day === 7) ? 7 : 6).map((name, index) => {
    const slots = sessions.map((slot, key) => ({ slot, key, start: minutes(slot.start), end: minutes(slot.end), lane: 0, lanes: 1 }))
      .filter(item => item.slot.day === index + 1)
      .sort((a, b) => a.start - b.start || a.end - b.end || a.key - b.key)
    // Simultaneous sessions share the width of their day instead of hiding one another.
    let group: typeof slots = []
    let groupEnd = -1
    const arrange = () => {
      const laneEnds: number[] = []
      for (const item of group) {
        const free = laneEnds.findIndex(end => end <= item.start)
        item.lane = free < 0 ? laneEnds.length : free
        laneEnds[item.lane] = item.end
      }
      for (const item of group) item.lanes = laneEnds.length
    }
    for (const item of slots) {
      if (item.start >= groupEnd) { arrange(); group = []; groupEnd = -1 }
      group.push(item)
      groupEnd = Math.max(groupEnd, item.end)
    }
    arrange()
    return { name, number: index + 1, slots }
  })
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, index) => {
    const minute = start + index * 60
    return { minute, label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:00` }
  })
  return { start, end, days, hours }
}
