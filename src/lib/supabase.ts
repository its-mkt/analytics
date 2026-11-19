import { createClient } from '@supabase/supabase-js';

/**
 * ad-insight 와 같은 Supabase 프로젝트 — 같은 주소(its.itket.com) 아래라 한쪽에서 로그인하면 다른 쪽도 로그인돼 있다.
 * 공개용(publishable) 키라 화면에 들어가도 된다.
 */
export const supabase = createClient(
  'https://tqxljgmygvanysqnhiar.supabase.co',
  'sb_publishable__Oq9NpOHnxEqRSZ02qJDaw_n-FIAGC2',
);
