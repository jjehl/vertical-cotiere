<script setup lang="ts">
import type { ClubEvent } from "#shared/types";
import { dateLabel } from "#shared/dates";
defineProps<{ event: ClubEvent }>();
</script>
<template>
  <NuxtLink :to="`/vie-du-club/${event.slug}`" class="event-row">
    <span class="event-date"
      ><strong>{{ dateLabel(event.start, { day: "2-digit" }) }}</strong
      ><span>{{ dateLabel(event.start, { month: "short" }) }}</span></span
    >
    <span class="event-info"
      ><span class="event-category"
        >{{ event.category
        }}<span v-if="event.eventState !== 'prévu'">
          · {{ event.eventState }}</span
        ></span
      ><strong>{{ event.title }}</strong
      ><span>{{ event.location }}</span></span
    >
    <span v-if="event.allDay" class="event-hour">Toute la journée</span
    ><span v-else class="event-hour">{{
      dateLabel(event.start, { hour: "2-digit", minute: "2-digit" })
    }}</span
    ><span class="round-arrow"><ArrowIcon /></span>
  </NuxtLink>
</template>
