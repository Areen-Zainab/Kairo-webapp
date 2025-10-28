import { useUser } from '../context/UserContext';

/**
 * Hook to determine if dummy data should be shown
 * Only shows dummy data for areeba@kairo.com
 */
export const useDummyData = () => {
  const { user } = useUser();
  const shouldShowDummyData = user?.email?.toLowerCase() === 'areeba@kairo.com';
  
  return { shouldShowDummyData };
};

