using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace PetClinic.PaymentService;
public static class EurekaConfigExtension
{

    /// <summary>
    /// Get all IP Address of the machine and se it to the Eureka Instance configuration
    /// </summary>
    /// <param name="builder"></param>
    /// <returns></returns>
    public static WebApplicationBuilder SetEurekaIps(this WebApplicationBuilder builder)
    {
        IList<string> ips = [];
        try
        {

            static Dictionary<IPAddress, IPAddress> GetAllNetworkInterfaceIpv4Addresses()
            {
                var map = new Dictionary<IPAddress, IPAddress>();
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    foreach (var uipi in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (uipi.Address.AddressFamily != AddressFamily.InterNetwork) continue;

                        if (uipi.IPv4Mask == null) continue; //ignore 127.0.0.1
                        map[uipi.Address] = uipi.IPv4Mask;
                    }
                }
                return map;
            }

            ips = GetAllNetworkInterfaceIpv4Addresses()
                .Keys
                .Where(w => w.ToString() != "127.0.0.1")
                .Select(x => x.ToString())
                .ToList();

        }
        catch (Exception)
        {
            try
            {
                ips = Dns.GetHostEntry("localhost")?.AddressList.Select(a => a.ToString()).ToArray() ?? [];
            }
            catch (Exception)
            {
                // ignored
            }
        }
        finally
        {
            ips = ips.Distinct().ToList();
            builder.Configuration["eureka:instance:ipAddress"] = string.Join(",", ips);
        }

        return builder;
    }

}
