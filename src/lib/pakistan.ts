/**
 * District → province, for filling the province field off a scanned CNIC.
 *
 * The card prints the district (ضلع) and the tehsil (تحصیل) but never the
 * province, so it cannot be read off the image — Faisalabad is Punjab, and the
 * word "Punjab" appears nowhere on the card. This is the lookup that turns one
 * into the other.
 *
 * Deliberately incomplete. A district that isn't listed returns '' so the desk
 * types it, because a wrong province filed to the portal is worse than a blank
 * one someone has to fill. Add districts here as they turn up rather than
 * guessing at a full list.
 */

export type Province =
  | 'Punjab'
  | 'Sindh'
  | 'Khyber Pakhtunkhwa'
  | 'Balochistan'
  | 'Islamabad Capital Territory'
  | 'Azad Jammu and Kashmir'
  | 'Gilgit-Baltistan'

const DISTRICTS: Record<Province, string[]> = {
  Punjab: [
    'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Sialkot',
    'Bahawalpur', 'Sargodha', 'Sheikhupura', 'Jhang', 'Gujrat', 'Kasur',
    'Rahim Yar Khan', 'Sahiwal', 'Okara', 'Dera Ghazi Khan', 'Muzaffargarh',
    'Vehari', 'Khanewal', 'Bahawalnagar', 'Chiniot', 'Toba Tek Singh',
    'Mandi Bahauddin', 'Hafizabad', 'Narowal', 'Nankana Sahib', 'Pakpattan',
    'Lodhran', 'Rajanpur', 'Layyah', 'Bhakkar', 'Khushab', 'Mianwali',
    'Attock', 'Chakwal', 'Jhelum',
  ],
  Sindh: [
    'Karachi', 'Karachi Central', 'Karachi East', 'Karachi West',
    'Karachi South', 'Malir', 'Korangi', 'Hyderabad', 'Sukkur', 'Larkana',
    'Mirpur Khas', 'Shaheed Benazirabad', 'Nawabshah', 'Jacobabad',
    'Shikarpur', 'Khairpur', 'Dadu', 'Thatta', 'Badin', 'Sanghar', 'Ghotki',
    'Umerkot', 'Tando Allahyar', 'Tando Muhammad Khan', 'Matiari', 'Jamshoro',
    'Kashmore', 'Naushahro Feroze', 'Sujawal', 'Tharparkar',
    'Qambar Shahdadkot',
  ],
  'Khyber Pakhtunkhwa': [
    'Peshawar', 'Mardan', 'Abbottabad', 'Swat', 'Nowshera', 'Charsadda',
    'Mansehra', 'Kohat', 'Bannu', 'Dera Ismail Khan', 'Swabi', 'Haripur',
    'Malakand', 'Chitral', 'Upper Dir', 'Lower Dir', 'Buner', 'Shangla',
    'Battagram', 'Karak', 'Hangu', 'Lakki Marwat', 'Tank', 'Torghar',
    'Kurram', 'Khyber', 'Bajaur', 'Mohmand', 'Orakzai', 'North Waziristan',
    'South Waziristan',
  ],
  Balochistan: [
    'Quetta', 'Gwadar', 'Kech', 'Turbat', 'Khuzdar', 'Sibi', 'Zhob',
    'Loralai', 'Pishin', 'Mastung', 'Kalat', 'Lasbela', 'Nushki', 'Chagai',
    'Panjgur', 'Awaran', 'Kharan', 'Jaffarabad', 'Nasirabad', 'Dera Bugti',
    'Kohlu', 'Barkhan', 'Musakhel', 'Sherani', 'Harnai', 'Ziarat',
    'Killa Abdullah', 'Killa Saifullah', 'Washuk', 'Sohbatpur', 'Jhal Magsi',
    'Duki', 'Surab',
  ],
  'Islamabad Capital Territory': ['Islamabad'],
  'Azad Jammu and Kashmir': [
    'Muzaffarabad', 'Mirpur', 'Kotli', 'Bhimber', 'Poonch', 'Rawalakot',
    'Bagh', 'Neelum', 'Sudhnoti', 'Haveli',
  ],
  'Gilgit-Baltistan': [
    'Gilgit', 'Skardu', 'Hunza', 'Nagar', 'Ghizer', 'Astore', 'Diamer',
    'Ghanche', 'Shigar', 'Kharmang',
  ],
}

/* "Faisalabad", "FAISALABAD", "Faisalabad District" and "Faisal Abad" are one
   district. Spacing is dropped rather than normalised because the card's
   transliteration splits names unpredictably. */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bdistrict\b|\bdistt\.?\b|\bzila\b|\bzilla\b/g, '')
    .replace(/[^a-z]/g, '')
}

const LOOKUP: Record<string, Province> = {}
for (const [province, districts] of Object.entries(DISTRICTS) as [Province, string[]][]) {
  for (const d of districts) LOOKUP[key(d)] = province
}

/** The province a district sits in, or '' when it is not one we know. */
export function districtToProvince(district: string | null | undefined): string {
  if (!district) return ''
  return LOOKUP[key(district)] ?? ''
}
