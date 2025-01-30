import React from "react";
import { FaFacebook, FaInstagram } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-gray-700 text-white py-8">
      <div className="container mx-auto grid md:grid-cols-3 gap-8 px-4">
        
        {/* Location Info */}
        <div>
          <p className="text-sm mb-4">
            We are located in Chief Drygeese Territory in Treaty 8, the traditional land of the Yellowknives Dene 
            and home to the North Slave Métis, and the Tłı̨chǫ people.
          </p>
          <p className="text-sm">
            <strong>Find Us:</strong> <br />
            Unit 101 <br />
            5001 Forrest Drive <br />
            Yellowknife, NT <br />
            X1A 2A7
          </p>
        </div>

        {/* Opening Hours */}
        <div>
          <h3 className="text-lg font-bold mb-4">Public Open Hours</h3>
          <p className="text-sm italic">For specific space hours, check our <a href="#" className="text-blue-400">Google Calendar</a></p>
          <p className="text-sm mt-2">
            <strong>Tues - Wed:</strong> Closed <br />
            <strong>Thurs - Fri:</strong> 3:00pm - 9:00pm <br />
            <strong>Sat - Sun:</strong> 11:00am - 6:00pm <br />
            <strong>Mon:</strong> Closed
          </p>
        </div>

        {/* Social Media Links */}
        <div>
          <h3 className="text-lg font-bold mb-4">Follow Us:</h3>
          <div className="flex space-x-4">
            <a href="#" className="text-white hover:text-gray-400">
              <FaFacebook size={24} />
            </a>
            <a href="#" className="text-white hover:text-gray-400">
              <FaInstagram size={24} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
