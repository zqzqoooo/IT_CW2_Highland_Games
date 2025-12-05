// server/utils/emailTemplate.js

/**
 * 生成报名确认邮件的 HTML
 * @param {string} name - 用户姓名
 * @param {Array} events - 赛事详情数组 [{name, event_date, event_time, location}, ...]
 * @returns {string} - 完整的 HTML 字符串
 */
const generateRegistrationEmail = (name, events) => {
  // 1. 生成赛事列表的 HTML 片段
  const eventsHtml = events.map(ev => `
    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
      <div style="background-color: #005eb8; padding: 10px 15px; color: #ffffff;">
        <h3 style="margin: 0; font-size: 18px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">🏅 ${ev.name}</h3>
      </div>
      <div style="padding: 15px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="25" valign="top">📅</td>
            <td style="padding-bottom: 8px; color: #333; font-family: sans-serif;"><strong>Date:</strong> ${ev.event_date || 'TBD'}</td>
          </tr>
          <tr>
            <td width="25" valign="top">⏰</td>
            <td style="padding-bottom: 8px; color: #333; font-family: sans-serif;"><strong>Time:</strong> ${ev.event_time || 'TBD'}</td>
          </tr>
          <tr>
            <td width="25" valign="top">📍</td>
            <td style="color: #333; font-family: sans-serif;"><strong>Location:</strong> ${ev.location || 'Main Arena'}</td>
          </tr>
        </table>
      </div>
    </div>
  `).join('');

  // 2. 返回完整的邮件 HTML 骨架
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Confirmed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 20px 0 40px 0;" align="center">
            
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
              
              <tr>
                <td style="background-color: #1a202c; padding: 30px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">PAISLEY HIGHLAND GAMES</h1>
                  <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Registration Confirmation</p>
                </td>
              </tr>

              <tr>
                <td style="padding: 30px;">
                  <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
                    Dear <strong>${name}</strong>,
                  </p>
                  <p style="font-size: 16px; line-height: 1.6; color: #555555; margin-bottom: 30px;">
                    We have successfully received your application! Here are the details of the competitions you have registered for:
                  </p>

                  ${eventsHtml}

                  <div style="background-color: #fff8dc; border-left: 4px solid #f6ad55; padding: 15px; margin-top: 30px; border-radius: 4px;">
                    <p style="margin: 0; color: #7c4a03; font-size: 14px;">
                      <strong>Current Status:</strong> PENDING APPROVAL<br>
                      Our team will review your application shortly. You can check your status anytime by logging into our website.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="margin: 0; font-size: 12px; color: #999999;">
                    &copy; 2025 Paisley Highland Games. All rights reserved.<br>
                    Paisley, Scotland, UK
                  </p>
                </td>
              </tr>

            </table>
            </td>
        </tr>
      </table>

    </body>
    </html>
  `;
};

module.exports = { generateRegistrationEmail };