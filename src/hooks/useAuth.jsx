import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  vendorStatus: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
  hasRole: () => false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vendorStatus, setVendorStatus] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkVendorStatus(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkVendorStatus(session.user);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkVendorStatus = async (user) => {
    try {
      // First check if user is a vendor
      const userRole = user.user_metadata?.role || '';
      
      if (userRole === 'vendor') {
        // Check vendor status from user metadata first (faster)
        const metadataStatus = user.user_metadata?.vendorStatus;
        
        if (metadataStatus) {
          setVendorStatus(metadataStatus);
          
          // Show appropriate messages based on status
          if (metadataStatus === 'Pending') {
            toast.error('Your vendor account is pending approval. Please contact the procurement officer.');
          } else if (metadataStatus === 'Suspended') {
            toast.error('Your vendor account has been suspended. Please contact the procurement officer.');
          }
        } else {
          // If not in metadata, check the vendors table
          try {
            const { data: vendor, error } = await supabase
              .from('vendors')
              .select('status, id')
              .eq('user_id', user.id)
              .maybeSingle(); // Use maybeSingle instead of single to handle no results
            
            if (error && error.code !== 'PGRST116') {
              // Handle rate limit errors gracefully
              if (error.code === '429' || error.message?.includes('rate limit')) {
                console.warn('Rate limit reached, using fallback approach');
                // Set a default status and continue
                setVendorStatus('Pending');
                setLoading(false);
                return;
              }
              throw error;
            }
            
            if (vendor) {
              setVendorStatus(vendor.status || 'Pending');
              
              // Update user metadata with vendor status and hasVendorProfile flag
              await supabase.auth.updateUser({
                data: { 
                  vendorStatus: vendor.status,
                  hasVendorProfile: true
                }
              });
              
              // If vendor exists but is not approved, show message
              if (vendor.status === 'Pending') {
                toast.error('Your vendor account is pending approval. Please contact the procurement officer.');
              } else if (vendor.status === 'Suspended') {
                toast.error('Your vendor account has been suspended. Please contact the procurement officer.');
              }
            } else {
              // No vendor profile found, set hasVendorProfile to false
              await supabase.auth.updateUser({
                data: { hasVendorProfile: false }
              });
            }
          } catch (error) {
            // Handle errors gracefully
            console.error('Error checking vendor status from database:', error);
            // Use metadata as fallback if available
            if (user.user_metadata?.hasVendorProfile) {
              setVendorStatus('Pending'); // Default to pending if we can't determine
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (requiredRole) => {
    if (!user) return false;
    
    // Get role from user metadata
    const userRole = user.user_metadata?.role || 'vendor';
    
    // Check if user has the required role
    // Admin has access to everything
    if (userRole === 'admin') return true;
    
    // Check specific role
    return userRole === requiredRole;
  };

  const value = {
    user,
    session,
    loading,
    vendorStatus,
    signIn: async (credentials) => {
      try {
        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data, error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Login error:', error);
        if (error.status === 503 || error.status === 429) {
          toast.error('Connection to authentication service failed. Please try again later.');
        } else if (error.status === 500) {
          toast.error('Server error. Please try again later.');
        } else {
          toast.error(error.message || 'An error occurred during login. Please try again.');
        }
        throw error;
      }
    },
    signUp: async (signupData) => {
      try {
        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // We can't check if email exists using admin API as regular users don't have access
        // Instead, we'll just attempt to sign up and handle any errors
        
        const { data, error } = await supabase.auth.signUp(signupData);
        
        if (error) {
          // Check for specific error codes
          if (error.code === 'user_already_exists') {
            throw {
              ...error,
              message: 'An account with this email already exists. Please use a different email or try logging in.'
            };
          }
          throw error;
        }
        return data;
      } catch (error) {
        console.error('Signup error:', error);
        throw error;
      }
    },
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } catch (error) {
        console.error('Signout error:', error);
        toast.error(error.message || 'An error occurred during sign out. Please try again.');
        throw error;
      }
    },
    updateUser: async (updates) => {
      try {
        const { data, error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Update user error:', error);
        toast.error(error.message || 'An error occurred while updating user. Please try again.');
        throw error;
      }
    },
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}