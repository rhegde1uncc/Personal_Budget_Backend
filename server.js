const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const jwt_decode = require('jwt-decode');
const mysql = require('mysql');

const jwt = require('jsonwebtoken');
const exjwt = require('express-jwt');

//const PORT = 3000;
const aTokensecretKey = 'My super secret key';
const rTokensecretKey = 'It is My refresh token secret key';
const saltRounds = 10;
let token;
let refreshToken;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-type,Authorization');
  res.setHeader('Content-Encoding', 'gzip');
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const jwtMW = exjwt({
  secret: aTokensecretKey,
  algorithms: ['HS256']
});

var pool = mysql.createPool({
  host: 'sql9.freemysqlhosting.net',
  user: 'sql9373689',
  password: 'vhPqVDD3YH',
  database: 'sql9373689'
});

app.get('/dummy', (req, res) => {
  res.send('Hello world');
});

//login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    console.log("Connected TO MYSQL DB!");
    connection.query('SELECT * FROM users WHERE username = ?', [username], async function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user details',
          token: null
        });
      } else {

        if (results.length > 0) {
          const comparePwd = await bcrypt.compare(password, results[0].password)
          if (comparePwd) {
            token = jwt.sign({ id: results[0].id, username: results[0].username }, aTokensecretKey, { expiresIn: '60s' });
            //token = jwt.sign({ id: results[0].id, username: results[0].username }, aTokensecretKey, { expiresIn: '1h' });
            refreshToken = jwt.sign({ id: results[0].id, username: results[0].username }, rTokensecretKey, { expiresIn: '3d' });
            var decoded = jwt_decode(token);
            console.log('first access token', token);
            console.log('first refresh token', refreshToken);
            return res.status(200).json({
              success: true,
              err: null,
              user: results[0],
              exp: decoded.exp,
              token,
              refreshToken
            })
          }
          else {
            return res.status(204).json({
              success: false,
              err: 'username and password does not match',
              token: null
            });
          }
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user does not exit',
            token: null
          });
        }
      }
    })
  });

});

//signup
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  const encryptedPassword = await bcrypt.hash(password, saltRounds)
  const signUpDate = new Date().toJSON().slice(0, 10);
  var user = {
    "username": username,
    "password": encryptedPassword,
    "email": email,
    "date": signUpDate
  }
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('INSERT INTO users SET ?', user, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while signup'
        })
      } else {
        return res.status(200).json({
          success: true,
          err: null,
          msg: 'user registered sucessfully!'
        })
      }

    });
  });
});


//refresh token
app.post('/refresh', async (req, res) => {
  const { uid, rToken } = req.body;
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    accessToken = req.headers.authorization.split(' ')[1];
}
  pool.getConnection(function (err, connection) {
    if (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    connection.query('SELECT * FROM users WHERE id = ?', [uid], async function (error, results, fields) {
      connection.release();
      if (error) {
        console.log(error);
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user details',
          token: null
        });
      } else {
        //verify the access token
        try {
          console.log('access ',accessToken);
          jwt.verify(accessToken, aTokensecretKey)
        }
        catch (e) {
          return res.status(400).json({
            success: false,
            err: 'error ocurred while verifying access token',
            token: null
          });
        }

        if (results.length > 0) {
          //verify the refresh token
          try {
            console.log('refresh ',rToken);
            jwt.verify(rToken, rTokensecretKey)
          }
          catch (e) {
            return res.status(400).json({
              success: false,
              err: 'error ocurred while verifying refresh token',
              token: null
            });
          }
          //Issue new access token
          token = jwt.sign({ id: results[0].id, username: results[0].username }, aTokensecretKey, { expiresIn: '60s' });
          //token = jwt.sign({ id: results[0].id, username: results[0].username }, aTokensecretKey, { expiresIn: '1h' });
          let refreshToken = jwt.sign({ id: results[0].id, username: results[0].username }, rTokensecretKey, { expiresIn: '3d' });
          var decoded = jwt_decode(token);
          console.log('refreshed access token', token);
          console.log('refreshed refresh token', refreshToken);
          return res.status(200).json({
            success: true,
            err: null,
            user: results[0],
            exp: decoded.exp,
            token,
            refreshToken: refreshToken
          })
        }

      }
    })
  });





});

//chart3
app.get('/budget/dashboard/chart3/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {

      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    console.log("Connected TO MYSQL DB!");
    let query = 'SELECT MONTHNAME(STR_TO_DATE(MONTH(date), "%m")) as month, sum(value) as total FROM user_budget_details WHERE uid = ? group by MONTH(date)'
    connection.query(query, [id], async function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user budget details',
          token: null
        });
      } else {

        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user budget details does not exit',
            token: null
          });
        }
      }
    })
  });
});

//chart1
app.get('/budget/dashboard/chart1/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {

      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    console.log("Connected TO MYSQL DB!");
    let query = 'SELECT categoryName as category, sum(value) as total FROM user_budget_details WHERE uid = ? group by categoryName'
    connection.query(query, [id], async function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user budget details',
          token: null
        });
      } else {

        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user budget details does not exit',
            token: null
          });
        }
      }
    })
  });
});

//chart2
app.get('/budget/dashboard/chart2/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {

      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    console.log("Connected TO MYSQL DB!");
    let query = 'SELECT ui.monthlyIncome as totalIncome , sum(ub.value) as totalExpense FROM user_budget_details ub  INNER JOIN user_income ui ON ub.uid = ui.uid WHERE ub.uid = ? group by ub.uid'
    connection.query(query, [id], async function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user budget details',
          token: null
        });
      } else {

        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user budget details does not exit',
            token: null
          });
        }
      }
    })
  });
});

//get all budget records for user
app.get('/budget/all/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database',
        token: null
      });
    }
    console.log("Connected TO MYSQL DB!");
    connection.query('SELECT * FROM user_budget_details WHERE uid = ?', [id], async function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user budget details',
          token: null
        });
      } else {

        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user budget details does not exit',
            token: null
          });
        }
      }
    })
  });
});

//add budget record for user
app.post('/budget/add', jwtMW, (req, res) => {
  const { uid, categoryName, value, date } = req.body;
  const entryDate = new Date(date).toJSON().slice(0, 10);
  var budget = {
    "uid": uid,
    "categoryName": categoryName,
    "value": value,
    "date": entryDate
  }
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('INSERT INTO user_budget_details SET ?', budget, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while adding expense'
        })
      } else {
        return res.status(200).json({
          success: true,
          err: null,
          msg: 'expense details added sucessfully!'
        })
      }

    });
  });

});

//add income for user
app.post('/income/add', jwtMW, (req, res) => {
  const { uid, monthlyIncome } = req.body;
  var income = {
    "uid": uid,
    "monthlyIncome": monthlyIncome
  }
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('INSERT INTO user_income SET ?', income, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while adding income'
        })
      } else {
        return res.status(200).json({
          success: true,
          err: null,
          msg: 'income value added sucessfully!'
        })
      }

    });
  });

});

//add budget category for user
app.post('/budget/config', jwtMW, (req, res) => {
  const { uid, categoryName } = req.body;
  var category = {
    "uid": uid,
    "categoryName": categoryName
  }
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('INSERT INTO user_budget_category SET ?', category, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while adding budget category'
        })
      } else {
        return res.status(200).json({
          success: true,
          err: null,
          msg: 'budget category added sucessfully!'
        })
      }

    });
  });
});

// get all budget category for user
app.get('/budget/category/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('SELECT DISTINCT categoryName FROM user_budget_category WHERE uid = ? order by categoryName', id, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching budget category'
        })
      } else {
        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user budget categories does not exit',
            token: null
          });
        }
      }

    });
  });
});

// get  income for user
app.get('/income/:id', jwtMW, (req, res) => {
  let id = req.params.id;
  pool.getConnection(function (err, connection) {
    if (err) {
      return res.status(400).json({
        success: false,
        err: 'error ocurred while connecting to database'
      });
    }
    console.log("Connected to mysql database!");
    connection.query('SELECT monthlyIncome FROM user_income WHERE uid = ?', id, function (error, results, fields) {
      connection.release();
      if (error) {
        return res.status(400).json({
          success: false,
          err: 'error ocurred while fetching user income'
        })
      } else {
        if (results.length > 0) {
          return res.status(200).json({
            success: true,
            err: null,
            data: results
          })
        }
        else {
          return res.status(206).json({
            success: false,
            err: 'user income details does not exit',
            token: null
          });
        }
      }

    });
  });
});


app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      err
    });
  }
  else {
    next(err);
  }

})

// app.listen(PORT, () => {
//   console.log(`serving on port ${PORT}`);
// });
module.exports = app;