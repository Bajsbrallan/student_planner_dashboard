using System;
using System.Threading.Tasks;
using Windows.Media.Control;

namespace MediaInfoApp
{
    class Program
    {
        static async Task Main(string[] args)
        {
            try
            {
                var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                var session = manager.GetCurrentSession();
                if (session != null)
                {
                    var props = await session.TryGetMediaPropertiesAsync();
                    if (props != null)
                    {
                        Console.WriteLine($"TITLE:{props.Title}");
                        Console.WriteLine($"ARTIST:{props.Artist}");
                        Console.WriteLine($"STATUS:{session.GetPlaybackInfo().PlaybackStatus}");
                        return;
                    }
                }
                Console.WriteLine("NONE");
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR:" + ex.Message);
            }
        }
    }
}
