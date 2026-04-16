import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bysryapfydqwdmjacgnf.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SHKO4BTZOxiDYBSkGFyq_Q_CMQ8dCBI'

export const supabase = createClient(supabaseUrl, supabaseKey)
