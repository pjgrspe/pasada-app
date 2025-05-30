import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Button from '@/components/Button';

interface TripFilters {
  status?: 'active' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  minRating?: number;
  searchQuery?: string;
}

interface TripFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: TripFilters) => void;
  currentFilters: TripFilters;
}

export const TripFilterModal: React.FC<TripFilterModalProps> = ({
  visible,
  onClose,
  onApplyFilters,
  currentFilters
}) => {
  const { colors } = useTheme();
  
  const [filters, setFilters] = useState<TripFilters>(currentFilters);
  const [searchQuery, setSearchQuery] = useState(currentFilters.searchQuery || '');
  const [tags, setTags] = useState(currentFilters.tags?.join(', ') || '');

  const statusOptions = [
    { value: undefined, label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const ratingOptions = [
    { value: undefined, label: 'Any Rating' },
    { value: 5, label: '5 Stars' },
    { value: 4, label: '4+ Stars' },
    { value: 3, label: '3+ Stars' },
    { value: 2, label: '2+ Stars' },
    { value: 1, label: '1+ Stars' },
  ];

  const handleApplyFilters = () => {
    const tagArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const finalFilters: TripFilters = {
      ...filters,
      tags: tagArray.length > 0 ? tagArray : undefined,
      searchQuery: searchQuery.trim() || undefined,
    };

    onApplyFilters(finalFilters);
    onClose();
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setTags('');
  };

  const handleDateSelection = (type: 'start' | 'end') => {
    // In a real app, you would open a date picker here
    // For now, we'll set some preset date ranges
    const now = new Date();
    
    if (type === 'start') {
      // Set to beginning of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilters(prev => ({ ...prev, startDate: startOfMonth }));
    } else {
      // Set to end of current month
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFilters(prev => ({ ...prev, endDate: endOfMonth }));
    }
  };

  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Select Date';
    return date.toLocaleDateString();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Filter Trips">
      <ScrollView style={styles.container}>
        {/* Search */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Search</Text>          <Input
            placeholder="Search locations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            iconName="search"
          />
        </View>

        {/* Status Filter */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip Status</Text>
          <View style={styles.optionsContainer}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: filters.status === option.value ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setFilters(prev => ({ ...prev, status: option.value as 'active' | 'completed' | 'cancelled' | undefined }))}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: filters.status === option.value ? '#FFFFFF' : colors.text,
                    }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Date Range</Text>
          <View style={styles.dateContainer}>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleDateSelection('start')}
            >
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
                From: {formatDate(filters.startDate)}
              </Text>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleDateSelection('end')}
            >
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
                To: {formatDate(filters.endDate)}
              </Text>
              <Ionicons name="calendar" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rating Filter */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Minimum Rating</Text>
          <View style={styles.optionsContainer}>
            {ratingOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: filters.minRating === option.value ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setFilters(prev => ({ ...prev, minRating: option.value }))}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: filters.minRating === option.value ? '#FFFFFF' : colors.text,
                    }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tags</Text>          <Input
            placeholder="Filter by tags (comma separated)"
            value={tags}
            onChangeText={setTags}
            iconName="pricetag"
          />
        </View>        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title="Clear All"
            onPress={handleClearFilters}
            variant="danger"
            style={styles.actionButton}
          />
          <Button
            title="Apply Filters"
            onPress={handleApplyFilters}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateContainer: {
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
  },
});
