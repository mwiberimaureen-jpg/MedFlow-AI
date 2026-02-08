/**
 * Custom hook to get current user and subscription status
 *
 * Usage in pricing page:
 *
 * const { user, subscription, loading } = useUser();
 *
 * if (loading) return <div>Loading...</div>;
 * if (!user) router.push('/login');
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email: string;
  full_name?: string;
  subscription_status: string;
  subscription_expires_at?: string;
}

interface SubscriptionStatus {
  isActive: boolean;
  status: string;
  expiresAt?: string;
  daysRemaining?: number;
  currentPlan?: string;
}

interface SubscriptionRPCResponse {
  is_active: boolean;
  subscription_status: string;
  expires_at?: string;
  days_remaining?: number;
  current_plan?: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient();

        // Get current auth user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!authUser) {
          setUser(null);
          setSubscription(null);
          setLoading(false);
          return;
        }

        // Get user profile with subscription info
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setUser(profile);

        // Get detailed subscription status
        const { data: subStatus, error: subError } = await supabase
          .rpc('get_user_subscription_status', { check_user_id: authUser.id })
          .single<SubscriptionRPCResponse>();

        if (subError) {
          console.error('Error fetching subscription status:', subError);
        } else if (subStatus) {
          setSubscription({
            isActive: subStatus.is_active,
            status: subStatus.subscription_status,
            expiresAt: subStatus.expires_at,
            daysRemaining: subStatus.days_remaining,
            currentPlan: subStatus.current_plan,
          });
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching user:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchUser();

    // Subscribe to auth state changes
    const supabase = createClient();
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchUser();
        } else {
          setUser(null);
          setSubscription(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  return { user, subscription, loading, error };
}
