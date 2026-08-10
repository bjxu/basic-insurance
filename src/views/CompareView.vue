<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ageToAgeClass,
  getHealthPremiums,
  loadPremiumsData,
  searchGemeinden,
  type Gemeinde,
  type HealthQuoteResult,
  type PremiumsData,
} from '../lib/health-premiums'

const form = reactive({
  age: 35,
  franchise: 300,
  accidentIncluded: true,
})

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 2,
})

const premiums = ref<PremiumsData | null>(null)
const premiumsError = ref<string | null>(null)
const healthResult = ref<HealthQuoteResult | null>(null)

// --- Location search (postcode or municipality name -> exact premium region) -------
const locationQuery = ref('')
const selectedLocation = ref<Gemeinde | null>(null)
const locationResults = computed(() =>
  premiums.value && !selectedLocation.value ? searchGemeinden(premiums.value, locationQuery.value) : [],
)

function selectLocation(g: Gemeinde) {
  selectedLocation.value = g
  locationQuery.value = `${g.plz} ${g.ort}`
}

function clearLocation() {
  selectedLocation.value = null
  locationQuery.value = ''
}

const ageClass = computed(() => ageToAgeClass(form.age))
const franchiseOptions = computed(
  () => premiums.value?.ageClasses[ageClass.value]?.franchises ?? [],
)

// Keep the selected franchise valid when age crosses an age-class boundary (children,
// young adults, and adults each have a different allowed set of deductibles).
watch(
  [ageClass, () => premiums.value],
  ([newAgeClass]) => {
    const opts = premiums.value?.ageClasses[newAgeClass]?.franchises
    if (opts && !opts.includes(form.franchise)) form.franchise = opts[0]!
  },
)

watch(
  [() => form.age, () => form.franchise, () => form.accidentIncluded, selectedLocation],
  async () => {
    if (!selectedLocation.value) {
      healthResult.value = null
      return
    }
    try {
      healthResult.value = await getHealthPremiums({
        canton: selectedLocation.value.canton,
        region: selectedLocation.value.region,
        age: form.age,
        franchise: form.franchise,
        accidentIncluded: form.accidentIncluded,
      })
      premiumsError.value = null
    } catch (err) {
      premiumsError.value = err instanceof Error ? err.message : String(err)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    premiums.value = await loadPremiumsData()
  } catch (err) {
    premiumsError.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <section class="compare">
    <h1>Compare health insurance premiums</h1>

    <form class="form" @submit.prevent>
      <label class="field">
        Age
        <input v-model.number="form.age" type="number" min="0" max="100" required />
      </label>

      <div class="field location-field">
        <label for="location-input">Postcode or municipality</label>
        <div v-if="selectedLocation" class="location-selected">
          <span>
            {{ selectedLocation.plz }} {{ selectedLocation.ort }},
            {{ selectedLocation.gemeinde }} ({{ selectedLocation.canton }}) &mdash;
            {{
              selectedLocation.region === 0
                ? 'single premium region (canton not split)'
                : `premium region ${selectedLocation.region}`
            }}
          </span>
          <button type="button" class="link-button" @click="clearLocation">Change</button>
        </div>
        <template v-else>
          <input
            id="location-input"
            v-model="locationQuery"
            type="text"
            placeholder="e.g. 8001 or Zürich"
            autocomplete="off"
          />
          <ul v-if="locationResults.length > 0" class="location-results">
            <li v-for="g in locationResults" :key="`${g.bfsNr}-${g.plz}`">
              <button type="button" @click="selectLocation(g)">
                {{ g.plz }} {{ g.ort }}, {{ g.gemeinde }} ({{ g.canton }})
              </button>
            </li>
          </ul>
          <p v-else-if="locationQuery.trim()" class="field-hint">No matching municipality found.</p>
        </template>
      </div>

      <label class="field">
        Deductible / Franchise (CHF)
        <select v-model.number="form.franchise" required>
          <option v-for="amount in franchiseOptions" :key="amount" :value="amount">
            {{ currency.format(amount) }}
          </option>
        </select>
      </label>

      <label class="field checkbox-field">
        <input v-model="form.accidentIncluded" type="checkbox" />
        Include accident coverage
      </label>
      <p class="field-hint">
        Leave this off if accidents are already covered through an employer (common
        for anyone working &ge;8h/week in Switzerland).
      </p>
    </form>

    <div class="result-block">
      <p v-if="premiumsError" class="error">Couldn't load premium data: {{ premiumsError }}</p>
      <p v-else-if="!selectedLocation" class="result-empty">
        Search for your postcode or municipality above to see premiums.
      </p>
      <template v-else-if="healthResult">
        <div v-if="healthResult.cheapest" class="result" role="status">
          <p class="result-label">Cheapest available</p>
          <p class="result-value">{{ currency.format(healthResult.cheapest.monthlyPremium) }} / month</p>
          <p class="result-sub">{{ healthResult.cheapest.insurerName }}</p>
          <p v-if="healthResult.medianPremium" class="result-sub">
            Median across {{ healthResult.quotes.length }} insurers:
            {{ currency.format(healthResult.medianPremium) }} / month
          </p>
        </div>
        <p v-else class="result-empty">No premiums found for this combination.</p>

        <table v-if="healthResult.quotes.length > 1" class="quote-table">
          <caption>Cheapest 5 insurers</caption>
          <thead>
            <tr>
              <th scope="col">Insurer</th>
              <th scope="col">Monthly premium</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="quote in healthResult.quotes.slice(0, 5)" :key="quote.insurerCode">
              <td>{{ quote.insurerName }}</td>
              <td>{{ currency.format(quote.monthlyPremium) }}</td>
            </tr>
          </tbody>
        </table>

        <p class="disclaimer">
          {{ premiums?.premiumYear }} mandatory health insurance (KVG/OKP) premiums,
          published by the
          <a :href="premiums?.sourceDataset" target="_blank" rel="noopener">Federal Office of
          Public Health (BAG)</a>, resolved to your exact
          <a :href="premiums?.sourceRegions" target="_blank" rel="noopener">premium region</a>
          via your municipality &mdash; not just your canton. Excludes supplementary
          insurance. Not shown: gender &mdash; Swiss law requires OKP premiums to be
          gender-neutral, so BAG's data has no such dimension.
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.compare {
  max-width: 560px;
}

.form {
  display: grid;
  gap: 1.1rem;
  padding: 1.25rem;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.field {
  display: grid;
  gap: 0.35rem;
  border: none;
  padding: 0;
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

.checkbox-field {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}

.field-hint {
  margin: -0.6rem 0 0;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.location-field {
  position: relative;
}

.location-selected {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  font-weight: 400;
  font-size: 0.9rem;
}

.link-button {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.location-results {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  max-height: 12rem;
  overflow-y: auto;
}

.location-results li + li {
  border-top: 1px solid var(--color-border);
}

.location-results button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.6rem;
  background: none;
  border: none;
  font: inherit;
  font-weight: 400;
  color: var(--color-text);
  cursor: pointer;
}

.location-results button:hover {
  background-color: var(--color-surface);
}

input[type='number'],
input[type='text'],
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 400;
}

.result-block {
  margin-top: 1.5rem;
}

.result {
  padding: 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  text-align: center;
}

.result-label {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.result-value {
  margin: 0.25rem 0 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
}

.result-sub {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted);
}

.result-empty {
  color: var(--color-text-muted);
  font-style: italic;
}

.error {
  color: #c0392b;
}

.quote-table {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.quote-table caption {
  text-align: left;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.quote-table th,
.quote-table td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.quote-table td:last-child,
.quote-table th:last-child {
  text-align: right;
}

.disclaimer {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
