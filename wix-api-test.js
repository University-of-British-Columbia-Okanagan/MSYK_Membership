import 'dotenv/config';
const WIX_API_KEY = process.env.WIX_API_KEY;
const WIX_SITE_ID = process.env.WIX_SITE_ID;

class WixExtendedBookingsAPI {
  constructor(apiKey, siteId) {
    this.apiKey = apiKey;
    this.siteId = siteId;
    this.baseUrl = 'https://www.wixapis.com';
  }

  // Get complete service details
  async getCompleteServiceDetails(serviceId) {
    try {
      console.log(`📋 Fetching complete service details for: ${serviceId}`);
      
      const response = await fetch(`${this.baseUrl}/bookings/v2/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'wix-site-id': this.siteId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const service = data.service;
        
        const serviceDetails = {
          id: service.id,
          name: service.name,
          description: service.description,
          type: service.type,
          tagLine: service.tagLine,
          
          // Correct pricing structure
          pricing: {
            rateType: service.payment?.rateType,
            value: service.payment?.fixed?.price?.value || 0,
            currency: service.payment?.fixed?.price?.currency || 'CAD',
            options: service.payment?.options
          },
          
          // Capacity
          capacity: {
            defaultCapacity: service.defaultCapacity,
            maxParticipantsPerBooking: service.bookingPolicy?.participantsPolicy?.maxParticipantsPerBooking
          },
          
          // Schedule information
          schedule: {
            id: service.schedule?.id,
            firstSessionStart: service.schedule?.firstSessionStart
          },
          
          // Locations
          locations: service.locations?.map(loc => ({
            type: loc.type,
            businessLocation: loc.businessLocation
          })),
          
          // Booking policy
          bookingPolicy: {
            isOnlineBookingEnabled: service.onlineBooking?.enabled,
            requireManualApproval: service.onlineBooking?.requireManualApproval,
            cancellationPolicy: service.bookingPolicy?.cancellationPolicy,
            reschedulePolicy: service.bookingPolicy?.reschedulePolicy
          },
          
          // URLs
          urls: service.urls,
          category: service.category,
          media: service.media,
          rawData: service
        };
        
        return serviceDetails;
      } else {
        console.log('❌ Failed to fetch service details');
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching service details:', error.message);
      return null;
    }
  }

  // Get all extended bookings using the correct API endpoint
  async getExtendedBookings() {
    try {
      console.log('📅 Fetching all extended bookings...');
      
      const response = await fetch(`${this.baseUrl}/bookings/bookings-reader/v2/extended-bookings/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'wix-site-id': this.siteId,
        },
        body: JSON.stringify({
         query: {
            sort: [
              {
                fieldName: "bookedEntity.slot.startDate",  // ✅ COPY THIS LINE (removed "booking." prefix)
                order: "ASC"
              }
            ],
            paging: {
              limit: 100,
              offset: 0
            }
          },
          withBookingAllowedActions: true,
          withBookingAttendanceInfo: true,
          withBookingConferencingDetails: false,
          withBookingPolicySettings: true,
          withBookingFeeDetails: true
        })
      });

      const responseText = await response.text();
      console.log('Extended bookings response status:', response.status);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('✅ Extended bookings fetched successfully');
        
        if (data.extendedBookings && data.extendedBookings.length > 0) {
          console.log(`\n📅 Found ${data.extendedBookings.length} bookings:`);
          
          const bookings = data.extendedBookings.map(extendedBooking => {
            const booking = extendedBooking.booking;
            
            return {
              id: booking.id,
              serviceId: booking.bookedEntity?.slot?.serviceId,
              serviceName: booking.bookedEntity?.title,
              sessionId: booking.bookedEntity?.slot?.sessionId,
              scheduleId: booking.bookedEntity?.slot?.scheduleId,
              sessionStart: booking.bookedEntity?.slot?.startDate,
              sessionEnd: booking.bookedEntity?.slot?.endDate,
              timezone: booking.bookedEntity?.slot?.timezone,
              status: booking.status,
              paymentStatus: booking.paymentStatus,
              selectedPaymentOption: booking.selectedPaymentOption,
              numberOfParticipants: booking.numberOfParticipants,
              totalParticipants: booking.totalParticipants,
              
              // Contact details
              contactDetails: {
                contactId: booking.contactDetails?.contactId,
                firstName: booking.contactDetails?.firstName,
                lastName: booking.contactDetails?.lastName,
                email: booking.contactDetails?.email,
                phone: booking.contactDetails?.phone,
                timeZone: booking.contactDetails?.timeZone,
                countryCode: booking.contactDetails?.countryCode
              },
              
              // Additional fields
              additionalFields: booking.additionalFields || [],
              
              // Resource/staff info
              resource: {
                id: booking.bookedEntity?.slot?.resource?.id,
                name: booking.bookedEntity?.slot?.resource?.name,
                email: booking.bookedEntity?.slot?.resource?.email,
                scheduleId: booking.bookedEntity?.slot?.resource?.scheduleId
              },
              
              // Location
              location: {
                id: booking.bookedEntity?.slot?.location?.id,
                name: booking.bookedEntity?.slot?.location?.name,
                locationType: booking.bookedEntity?.slot?.location?.locationType
              },
              
              // Booking source
              bookingSource: {
                platform: booking.bookingSource?.platform,
                actor: booking.bookingSource?.actor,
                appName: booking.bookingSource?.appName
              },
              
              // Dates
              createdDate: booking.createdDate,
              updatedDate: booking.updatedDate,
              startDate: booking.startDate,
              endDate: booking.endDate,
              
              // Tags
              tags: booking.bookedEntity?.tags || [],
              
              // Raw booking data
              rawBookingData: booking,
              rawExtendedData: extendedBooking
            };
          });
          
          return bookings;
        } else {
          console.log('📝 No extended bookings found');
          return [];
        }
      } else {
        console.log('❌ Failed to fetch extended bookings');
        console.log('Response:', responseText);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching extended bookings:', error.message);
      return null;
    }
  }

  // Get extended bookings for a specific service
  async getServiceExtendedBookings(serviceId) {
    try {
      console.log(`📅 Fetching extended bookings for service: ${serviceId}`);
      
      const response = await fetch(`${this.baseUrl}/bookings/bookings-reader/v2/extended-bookings/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'wix-site-id': this.siteId,
        },
        body: JSON.stringify({
          query: {
            filter: {
              "bookedEntity.slot.serviceId": {
                $eq: serviceId
              }
            },
            sort: [
              {
                fieldName: "bookedEntity.slot.startDate",
                order: "ASC"
              }
            ],
            paging: {
              limit: 50,
              offset: 0
            }
          },
          withBookingAllowedActions: true,
          withBookingAttendanceInfo: true,
          withBookingConferencingDetails: false,
          withBookingPolicySettings: true,
          withBookingFeeDetails: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Found ${data.extendedBookings?.length || 0} bookings for this service`);
        return data.extendedBookings || [];
      } else {
        console.log('❌ Failed to fetch service bookings');
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching service bookings:', error.message);
      return [];
    }
  }

  // Get all services with complete data and their extended bookings
  async getAllServicesAndExtendedBookings() {
    try {
      console.log('🎯 Fetching all services with complete data and extended bookings...\n');
      
      // First, get all services
      const response = await fetch(`${this.baseUrl}/bookings/v2/services/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'wix-site-id': this.siteId,
        },
        body: JSON.stringify({
          query: {
            paging: {
              limit: 50,
              offset: 0
            }
          }
        })
      });

      if (!response.ok) {
        console.log('❌ Failed to fetch services');
        return null;
      }

      const data = await response.json();
      console.log(`Found ${data.services?.length || 0} services\n`);
      
      // Get all extended bookings
      console.log('📅 Fetching all extended bookings...');
      const allBookings = await this.getExtendedBookings();
      
      const completeData = {
        services: [],
        bookings: allBookings || []
      };
      
      // Get complete details for each service
      for (const service of data.services || []) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing: ${service.name}`);
        console.log(`${'='.repeat(60)}`);
        
        const serviceDetails = await this.getCompleteServiceDetails(service.id);
        
        if (serviceDetails) {
          // Get bookings for this specific service
          const serviceBookings = allBookings?.filter(booking => 
            booking.serviceId === service.id
          ) || [];
          
          const completeService = {
            ...serviceDetails,
            bookings: serviceBookings
          };
          
          completeData.services.push(completeService);
          
          // Display the service information
          this.displayServiceInfo(completeService);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return completeData;
    } catch (error) {
      console.error('❌ Error fetching complete data:', error.message);
      return null;
    }
  }

  // Display service and booking information
  displayServiceInfo(service) {
    console.log(`\n📋 ${service.name}`);
    console.log(`   ID: ${service.id}`);
    console.log(`   Type: ${service.type}`);
    console.log(`   Description: ${service.description}`);
    
    console.log(`\n💰 Pricing:`);
    console.log(`   Rate Type: ${service.pricing.rateType}`);
    console.log(`   Price: ${service.pricing.value} ${service.pricing.currency}`);
    console.log(`   Online Payment: ${service.pricing.options?.online ? 'Yes' : 'No'}`);
    
    console.log(`\n👥 Capacity:`);
    console.log(`   Default Capacity: ${service.capacity.defaultCapacity || 'Not specified'}`);
    console.log(`   Max Per Booking: ${service.capacity.maxParticipantsPerBooking || 'Not specified'}`);
    
    console.log(`\n🔧 Booking Policy:`);
    console.log(`   Online Booking: ${service.bookingPolicy.isOnlineBookingEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Manual Approval: ${service.bookingPolicy.requireManualApproval ? 'Required' : 'Not required'}`);
    
    if (service.category) {
      console.log(`\n📂 Category: ${service.category.name}`);
    }
    
    if (service.urls) {
      console.log(`\n🔗 Booking Page: ${service.urls.bookingPage?.url || 'Not available'}`);
    }
    
    // Show bookings for this service
    if (service.bookings && service.bookings.length > 0) {
      console.log(`\n📅 BOOKINGS FOR THIS SERVICE (${service.bookings.length}):`);
      service.bookings.forEach((booking, index) => {
        const sessionStart = new Date(booking.sessionStart);
        const sessionEnd = new Date(booking.sessionEnd);
        console.log(`\n   ${index + 1}. Booking ID: ${booking.id}`);
        console.log(`      Client: ${booking.contactDetails.firstName || ''} ${booking.contactDetails.lastName || ''}`);
        console.log(`      Email: ${booking.contactDetails.email}`);
        console.log(`      Session: ${sessionStart.toLocaleString()} - ${sessionEnd.toLocaleString()}`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Payment Status: ${booking.paymentStatus}`);
        console.log(`      Payment Method: ${booking.selectedPaymentOption}`);
        console.log(`      Participants: ${booking.numberOfParticipants}`);
        console.log(`      Session ID: ${booking.sessionId}`);
        console.log(`      Resource/Staff: ${booking.resource.name || 'Not assigned'}`);
        console.log(`      Location: ${booking.location.name || 'Not specified'}`);
        console.log(`      Booking Source: ${booking.bookingSource.platform} (${booking.bookingSource.actor})`);
        console.log(`      Created: ${new Date(booking.createdDate).toLocaleString()}`);
        
        if (booking.additionalFields.length > 0) {
          console.log(`      Additional Fields:`);
          booking.additionalFields.forEach(field => {
            console.log(`        - ${field.label}: ${field.value || 'No value'}`);
          });
        }
      });
    } else {
      console.log(`\n📅 Bookings: No bookings found for this service`);
    }
  }
}

// Usage example
async function main() {
  console.log('🚀 Starting Complete Wix Extended Bookings API test...\n');
  
  if (WIX_API_KEY === 'your-api-key-here') {
    console.log('❌ Please replace WIX_API_KEY with your actual API key');
    return;
  }
  
  const wixAPI = new WixExtendedBookingsAPI(WIX_API_KEY, WIX_SITE_ID);
  
  console.log('='.repeat(80));
  console.log('🎯 FETCHING COMPLETE SERVICES AND EXTENDED BOOKINGS DATA');
  console.log('='.repeat(80));
  
  // Get all services and extended bookings with complete details
  const completeData = await wixAPI.getAllServicesAndExtendedBookings();
  
  if (completeData) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 SUCCESS! Complete data retrieved');
    console.log('='.repeat(80));
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total Services: ${completeData.services.length}`);
    console.log(`Total Bookings: ${completeData.bookings.length}`);
    
    completeData.services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name}`);
      console.log(`   - Price: ${service.pricing.value} ${service.pricing.currency}`);
      console.log(`   - Capacity: ${service.capacity.defaultCapacity}`);
      console.log(`   - Bookings: ${service.bookings.length}`);
    });
    
    if (completeData.bookings.length > 0) {
      console.log('\n📅 ALL BOOKINGS SUMMARY:');
      completeData.bookings.forEach((booking, index) => {
        const sessionDate = new Date(booking.sessionStart);
        console.log(`${index + 1}. ${booking.serviceName} - ${booking.contactDetails.firstName} ${booking.contactDetails.lastName} - ${sessionDate.toLocaleDateString()} ${sessionDate.toLocaleTimeString()}`);
      });
    }
    
  } else {
    console.log('\n❌ Failed to retrieve complete data');
  }
}

// Run the test
main();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WixExtendedBookingsAPI };
}